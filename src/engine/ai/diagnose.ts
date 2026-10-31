/**
 * 错误分层诊断（JY-07 §7 唯一权威源）
 *
 * 纪律：**先区分错误类别，再猜原因** —— `Failed to fetch` 有四种含义
 * （跨域 / 地址不可达 / DNS / TLS），不能一律报成跨域。
 * 用 no-cors 可达性探测把 `cors` 与 `network` 分开：
 * - 探测成功 → 服务器可达，是 CORS 拦截；
 * - 探测失败 → 网络层不通（地址不可达 / DNS / TLS），归 `network` 并提示三种可能。
 * 四类可诊断错误：`offline` / `timeout` / `cors` / `network`；HTTP 状态另作细分提示。
 */

export type AiErrorCategory = 'offline' | 'timeout' | 'cors' | 'network' | 'http'

export interface AiDiagnosis {
  category: AiErrorCategory
  title: string
  detail: string
  retryable: boolean
}

export function diagnoseOffline(): AiDiagnosis {
  return {
    category: 'offline',
    title: '当前无网络',
    detail: 'AI 解读需要联网；离线功能（排盘 / 起卦 / 查记录）不受影响，可稍后重试。',
    retryable: true
  }
}

export function diagnoseTimeout(timeoutMs: number): AiDiagnosis {
  return {
    category: 'timeout',
    title: '请求超时',
    detail: `超过 ${Math.round(timeoutMs / 1000)} 秒未收到服务商响应。可重试、更换更快的模型，或检查服务商状态。`,
    retryable: true
  }
}

export function diagnoseCors(): AiDiagnosis {
  return {
    category: 'cors',
    title: '服务商拒绝了网页直连（CORS）',
    detail:
      '服务地址可达，但浏览器拦截了跨域响应。请确认 Base URL 是服务商官方地址，且该服务商允许网页端直连（可换用其它服务商或自定义网关）。', // prettier-ignore
    retryable: true
  }
}

export function diagnoseNetwork(): AiDiagnosis {
  return {
    category: 'network',
    title: '无法连接到服务商',
    detail: '地址不可达、DNS 解析失败或 TLS 证书异常。请检查 Base URL 拼写、网络与代理设置。',
    retryable: true
  }
}

export interface FetchFailureInfo {
  /** navigator.onLine；测试注入 */
  online?: boolean
  /** no-cors 可达性探测结果；测试注入 */
  probeOk?: boolean
}

/** 纯函数版分层诊断：client 捕获 fetch 异常后调用 */
export function diagnoseFetchFailure(info: FetchFailureInfo): AiDiagnosis {
  if (info.online === false) return diagnoseOffline()
  if (info.probeOk === true) return diagnoseCors()
  return diagnoseNetwork()
}

/** HTTP 状态细分：密钥 / 模型名 / 限流 / 服务端各有明确指引（JY-07 §7 模型名过期） */
export function diagnoseHttpStatus(status: number): AiDiagnosis {
  if (status === 401 || status === 403) {
    return {
      category: 'http',
      title: `密钥被拒绝（HTTP ${status}）`,
      detail: '请回设置页核对 API Key 是否正确、是否有该模型的调用权限。',
      retryable: false
    }
  }
  if (status === 404) {
    return {
      category: 'http',
      title: `地址或模型不存在（HTTP 404）`,
      detail:
        '预设只是"当时的默认值"：请检查 Base URL 路径，并确认模型名是否已下架 —— 模型名可自行编辑。',
      retryable: false
    }
  }
  if (status === 429) {
    return {
      category: 'http',
      title: '请求过于频繁（HTTP 429）',
      detail: '触发了服务商限流或额度用尽，请稍后重试或检查账户余额。',
      retryable: true
    }
  }
  return {
    category: 'http',
    title: `服务商返回错误（HTTP ${status}）`,
    detail: '服务商端出现问题，可稍后重试；多次失败可更换服务商。',
    retryable: true
  }
}

/**
 * no-cors 可达性探测：opaque response 只要 fetch resolve 即视为"地址可达"。
 * 仅用于区分 cors / network，不读取任何响应内容。
 */
export async function probeReachable(url: string, timeoutMs = 5000): Promise<boolean> {
  if (typeof fetch !== 'function') return false
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    await fetch(url, { method: 'HEAD', mode: 'no-cors', signal: controller.signal })
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}
