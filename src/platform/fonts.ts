/**
 * 标题字体的**按需**加载
 *
 * 策略（离线优先 + 隐私优先）：
 * - 默认**不加载**：系统字体栈（宋体 / 黑体 / PingFang）零字节、离线可用、无第三方请求；
 * - 用户在设置里显式开启后才联网取 webfont，且失败 / 超时静默回退到系统字体，**不影响任何功能**；
 * - 断网时直接跳过（不发起必然失败的请求）—— JY-05 §3 走查第 10 项要求断网全功能可用。
 *
 * `tokens.css` 的字体栈已把 'Noto Serif SC' / 'Noto Sans SC' 排在首位：
 * 本地装了就用本地，webfont 只在本地没有时才真正生效，因此加载是**增强**而非**依赖**。
 */
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@600&family=Noto+Sans+SC:wght@400;500&display=swap'

const READY_FLAG = 'webfont'

let link: HTMLLinkElement | null = null

export function isWebFontReady(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.dataset[READY_FLAG] === 'ready'
}

/** 卸载：移除样式表与标记，回到系统字体 */
export function unloadWebFonts(): void {
  if (typeof document === 'undefined') return
  link?.remove()
  link = null
  delete document.documentElement.dataset[READY_FLAG]
}

export interface LoadOptions {
  /** 超时（ms）：超时视为失败，不阻塞界面 */
  timeout?: number
  /** 强制在线判定（供测试注入） */
  online?: boolean
}

/** 加载联网字体；返回是否就绪。任何异常都返回 false，绝不抛出 */
export async function loadWebFonts(opts: LoadOptions = {}): Promise<boolean> {
  if (typeof document === 'undefined') return false
  if (isWebFontReady()) return true

  const online = opts.online ?? (typeof navigator === 'undefined' ? true : navigator.onLine !== false)
  if (!online) return false

  try {
    unloadWebFonts()
    const el = document.createElement('link')
    el.rel = 'stylesheet'
    el.href = FONT_HREF
    document.head.appendChild(el)
    link = el

    return await new Promise<boolean>((resolve) => {
      let settled = false
      const finish = (ok: boolean) => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        if (!ok) unloadWebFonts()
        resolve(ok)
      }
      el.addEventListener('load', () => {
        document.documentElement.dataset[READY_FLAG] = 'ready'
        finish(true)
      })
      el.addEventListener('error', () => finish(false))
      const timer = window.setTimeout(() => finish(isWebFontReady()), opts.timeout ?? 4000)
    })
  } catch {
    unloadWebFonts()
    return false
  }
}
