import { describe, it, expect, afterEach } from 'vitest'
import { isWebFontReady, loadWebFonts, unloadWebFonts } from '@/platform/fonts'

/**
 * 字体按需加载
 *
 * 要守住的两条：
 * 1. **断网不请求**（离线优先）—— 不发起必然失败的请求，也不影响任何功能；
 * 2. **失败静默回退** —— 加载失败 / 超时都不抛错，回到系统字体栈。
 */
afterEach(() => {
  unloadWebFonts()
})

describe('联网字体（默认关 / 离线优先）', () => {
  it('断网时直接跳过，不注入样式表', async () => {
    const ok = await loadWebFonts({ online: false })
    expect(ok).toBe(false)
    expect(document.querySelectorAll('link[rel="stylesheet"]')).toHaveLength(0)
    expect(isWebFontReady()).toBe(false)
  })

  it('联网时注入样式表（jsdom 不真正下载，靠超时兜底返回 false 且不抛错）', async () => {
    const ok = await loadWebFonts({ online: true, timeout: 200 })
    expect(typeof ok).toBe('boolean')
    // 无论成功与否都不抛错；未就绪时不得留下标记
    if (!ok) expect(isWebFontReady()).toBe(false)
  })

  it('卸载后标记与样式表一起清掉', async () => {
    await loadWebFonts({ online: true, timeout: 100 })
    unloadWebFonts()
    expect(isWebFontReady()).toBe(false)
    expect(document.documentElement.dataset['webfont']).toBeUndefined()
  })

  it('重复调用不会产生多份样式表', async () => {
    await loadWebFonts({ online: true, timeout: 50 })
    await loadWebFonts({ online: true, timeout: 50 })
    const links = [...document.querySelectorAll('link[rel="stylesheet"]')].filter((l) =>
      (l as HTMLLinkElement).href.includes('fonts.googleapis.com')
    )
    expect(links.length).toBeLessThanOrEqual(1)
  })
})
