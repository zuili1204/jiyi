import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 桌面兜底布局的可量化部分：窄列与固定栏必须同宽
 *
 * 背景：宽屏下 `#app` 被限制成 420px 居中窄列，但底部导航是 `position: fixed; left:0; right:0`
 * —— fixed 元素相对**视口**定位，不限宽就会被拉伸到整个窗口宽，三个 tab 被均分到 1080px 上，
 * 与内容列彻底错位（"底部栏散架"）。窄屏看不出，宽屏必现，属于典型的"只在桌面兜底才暴露"的 bug。
 *
 * 本用例把"两者共用同一个 token"钉死：CSS 里写死像素值就会红。
 */
const tokens = readFileSync(join(process.cwd(), 'src', 'assets', 'styles', 'tokens.css'), 'utf8')
const base = readFileSync(join(process.cwd(), 'src', 'assets', 'styles', 'base.css'), 'utf8')
const app = readFileSync(join(process.cwd(), 'src', 'App.vue'), 'utf8')

function ruleOf(source: string, selector: string): string {
  const i = source.indexOf(selector)
  if (i < 0) throw new Error(`找不到规则 ${selector}`)
  const start = source.indexOf('{', i)
  const end = source.indexOf('}', start)
  return source.slice(start + 1, end)
}

describe('窄列与固定栏对齐（桌面兜底）', () => {
  it('--app-max 在 tokens 中定义（唯一尺寸来源）', () => {
    expect(tokens).toMatch(/--app-max:\s*\d+px\s*;/)
  })

  it('#app 用 var(--app-max) 限宽，不写死像素', () => {
    expect(ruleOf(base, '#app {')).toMatch(/max-width:\s*var\(--app-max\)/)
  })

  it('.tabbar 与 #app 同宽（同 token），且水平居中', () => {
    const tabbar = ruleOf(app, '.tabbar {')
    expect(tabbar).toMatch(/max-width:\s*var\(--app-max\)/)
    expect(tabbar).toMatch(/margin-inline:\s*auto/)
    expect(tabbar).toMatch(/position:\s*fixed/)
  })
})
