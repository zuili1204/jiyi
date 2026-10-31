import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 视觉走查的可量化部分：颜色对比度（WCAG）
 *
 * 真机上"看不清"的问题，一半能在构建期算出来 —— 对比度就是其中之一。
 * 本用例直接从 `tokens.css` 解析色值，避免测试里再抄一份常量导致漂移。
 *
 * 阈值：正文文字 ≥ 4.5:1（AA）；大号文字 / 非文本元素 ≥ 3:1。
 */
const css = readFileSync(join(process.cwd(), 'src', 'assets', 'styles', 'tokens.css'), 'utf8')

function block(selector: string): string {
  const i = css.indexOf(selector)
  if (i < 0) throw new Error(`tokens.css 中找不到 ${selector}`)
  const start = css.indexOf('{', i)
  const end = css.indexOf('}', start)
  return css.slice(start + 1, end)
}

function varsOf(selector: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of block(selector).matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    out[m[1]] = m[2].trim()
  }
  return out
}

function toRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16)
  ]
}

function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

const dark = varsOf(':root')
const light = varsOf("body[data-theme='light']")

describe('对比度（深色主题）', () => {
  const bg = dark['--bg']
  const panel = dark['--panel']
  for (const key of ['--text', '--text-2', '--text-3']) {
    it(`${key} 对底色与面板均 ≥ 4.5:1`, () => {
      expect(contrast(dark[key], bg), `${key} vs bg`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(dark[key], panel), `${key} vs panel`).toBeGreaterThanOrEqual(4.5)
    })
  }
  it('主色（朱砂）作为强调色 ≥ 3:1', () => {
    expect(contrast(dark['--cinnabar-bright'], bg)).toBeGreaterThanOrEqual(3)
  })
  it('主按钮：白字压朱砂 ≥ 4.5:1', () => {
    expect(contrast('#ffffff', dark['--cinnabar'])).toBeGreaterThanOrEqual(4.5)
  })
})

describe('对比度（浅色主题）', () => {
  const bg = light['--bg']
  const panel = light['--panel']
  for (const key of ['--text', '--text-2', '--text-3']) {
    it(`${key} 对底色与面板均 ≥ 4.5:1`, () => {
      expect(contrast(light[key], bg), `${key} vs bg`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(light[key], panel), `${key} vs panel`).toBeGreaterThanOrEqual(4.5)
    })
  }
  it('主按钮：白字压朱砂 ≥ 4.5:1', () => {
    expect(contrast('#ffffff', light['--cinnabar'])).toBeGreaterThanOrEqual(4.5)
  })
})

describe('token 完整性', () => {
  /** 只比对颜色变量（尺寸 / 时长 / 字体在 :root 定义后由浅色主题继承，无需重复） */
  const COLOR_KEYS = [
    '--bg',
    '--bg-2',
    '--panel',
    '--panel-2',
    '--line',
    '--line-soft',
    '--cinnabar',
    '--cinnabar-bright',
    '--cinnabar-dim',
    '--bronze',
    '--bronze-bright',
    '--bronze-dim',
    '--text',
    '--text-2',
    '--text-3'
  ]
  it('两套主题定义同一组颜色变量（不缺项）', () => {
    for (const k of COLOR_KEYS) {
      expect(dark[k], `深色主题缺 ${k}`).toBeDefined()
      expect(light[k], `浅色主题缺 ${k}`).toBeDefined()
    }
  })
  it('关键色值均为合法的十六进制', () => {
    for (const v of [...Object.values(dark), ...Object.values(light)]) {
      if (v.startsWith('#')) expect(v).toMatch(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
    }
  })
})
