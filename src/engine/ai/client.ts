import type { AiConfig } from '@/platform/storage'
import type { AiInterpretation, ReadingRecord } from '@/types/reading'
import { buildAiPrompt } from './prompt'
import { scanAiOutput } from './scan'
import {
  diagnoseFetchFailure,
  diagnoseHttpStatus,
  diagnoseTimeout,
  probeReachable,
  type AiErrorCategory
} from './diagnose'

/**
 * BYOK 请求客户端（JY-07 §3 / §4 / §7）
 *
 * - `fetch` + `AbortController`，OpenAI 兼容 `POST {baseUrl}/chat/completions`，**零新增依赖**；
 * - 超时：明确计时并给出超时提示（JY-07 §7）；
 * - 取消语义：自增 token 作废迟到结果 —— 取消 / 重新发起后，先前的响应**不会**被渲染（§9 验收 5）；
 * - 密钥安全：错误信息与诊断只含类别与指引，**永不携带密钥**（§8，JY-04 §7 扫描项）。
 */

export const AI_TIMEOUT_MS = 60_000

export type AiRunResult =
  | { status: 'ok'; ai: AiInterpretation }
  | { status: 'cancelled' }
  | { status: 'error'; category?: AiErrorCategory; title: string; detail: string }

export interface AiSession {
  run(record: ReadingRecord): Promise<AiRunResult>
  cancel(): void
}

export interface AiClientOptions {
  timeoutMs?: number
}

/** 自增令牌：全局计数，取消或新会话都会使在途请求的迟到结果失效 */
let tokenSeq = 0

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

function isAbortLike(e: unknown): boolean {
  return e instanceof Error && (e.name === 'AbortError' || e.name === 'TimeoutError')
}

export function createAiSession(config: AiConfig, opts: AiClientOptions = {}): AiSession {
  const myToken = ++tokenSeq
  let cancelled = false
  let controller: AbortController | undefined

  const invalidated = () => cancelled || myToken !== tokenSeq

  function cancel(): void {
    cancelled = true
    controller?.abort()
  }

  async function run(record: ReadingRecord): Promise<AiRunResult> {
    if (!config.apiKey) {
      return {
        status: 'error',
        title: '尚未配置密钥',
        detail: '请在「设置 → AI 深度解读」中选择服务商并填写 API Key。'
      }
    }
    if (!config.baseUrl || !config.model) {
      return { status: 'error', title: '配置不完整', detail: 'Base URL 与模型名不能为空。' }
    }

    const { system, user } = buildAiPrompt(record, { allowSensitive: config.allowSensitive })
    controller = new AbortController()
    const timeoutMs = opts.timeoutMs ?? AI_TIMEOUT_MS
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller?.abort()
    }, timeoutMs)

    try {
      const res = await fetch(`${trimSlash(config.baseUrl)}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          temperature: config.temperature,
          stream: false,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ]
        }),
        signal: controller.signal
      })

      // 迟到结果在这里被丢弃：token 已作废就不再解析（验收 5）
      if (invalidated()) return { status: 'cancelled' }

      if (!res.ok) {
        const d = diagnoseHttpStatus(res.status)
        return { status: 'error', category: d.category, title: d.title, detail: d.detail }
      }

      const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] }
      if (invalidated()) return { status: 'cancelled' }

      const text = data?.choices?.[0]?.message?.content
      if (typeof text !== 'string' || !text.trim()) {
        return {
          status: 'error',
          title: '模型返回为空',
          detail: '服务商没有返回内容：可稍后重试，或更换模型名。'
        }
      }

      // 后检只标记不改写（JY-07 §6）
      const { flagged } = scanAiOutput(text, record.kind)
      const ai: AiInterpretation = {
        text,
        model: config.model,
        createdAt: Date.now(),
        ...(flagged.length ? { flagged } : {})
      }
      return { status: 'ok', ai }
    } catch (e) {
      // 用户取消 / 会话已失效 → 一律按取消处理，不渲染
      if (invalidated() || (isAbortLike(e) && !timedOut)) return { status: 'cancelled' }
      if (timedOut && isAbortLike(e)) {
        const d = diagnoseTimeout(timeoutMs)
        return { status: 'error', category: d.category, title: d.title, detail: d.detail }
      }
      const online = typeof navigator !== 'undefined' ? navigator.onLine !== false : true
      const probeOk = online ? await probeReachable(trimSlash(config.baseUrl)) : false
      if (invalidated()) return { status: 'cancelled' }
      const d = diagnoseFetchFailure({ online, probeOk })
      return { status: 'error', category: d.category, title: d.title, detail: d.detail }
    } finally {
      clearTimeout(timer)
    }
  }

  return { run, cancel }
}
