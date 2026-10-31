import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * taibu 独立计算源仓库（波3）：梅花 / 奇门
 *
 * 数据由 taibu-core@3.5.0（MIT）运行时按固定时间计算产出：
 *   - DOCS/golden/taibu-meihua.json （node taibu-meihua-sample.mjs）
 *   - DOCS/golden/taibu-qimen.json    （node taibu-qimen-sample.mjs）
 * 只读静态 JSON、不依赖 dist 构建，CI 可稳定跑。
 *
 * 守卫：独立源 golden 就位、`reviewed:false`、关键排盘字段结构完整——
 * 用作判读参考，不冒充权威 golden。
 */
function load(path: string) {
  return JSON.parse(readFileSync(join(process.cwd(), 'DOCS/golden', path), 'utf8'))
}

describe('梅花独立计算源 golden', () => {
  it('元信息 + 两个样本就位', () => {
    const g = load('taibu-meihua.json')
    expect(g.reviewed).toBe(false)
    expect(g.source).toContain('taibu-core')
    expect(g.samples.length).toBeGreaterThanOrEqual(2)
  })

  it('体用 / 动爻 / 变卦 / 互卦 落盘齐全', () => {
    const g = load('taibu-meihua.json')
    for (const s of g.samples) {
      expect(s['起卦信息'].方法).toBeTruthy()
      expect(s['卦盘']['本卦']['卦名']).toBeTruthy()
      expect(s['卦盘']['本卦']['上卦']).toBeTruthy()
      expect(s['卦盘']['动爻']).toBeTruthy()
      expect(s['卦盘']['体卦']['卦名']).toBeTruthy()
      expect(s['卦盘']['用卦']['卦名']).toBeTruthy()
      expect(s['卦盘']['变卦']['卦名']).toBeTruthy()
      expect(s['卦盘']['互卦']['卦名']).toBeTruthy()
    }
  })
})

describe('奇门独立计算源 golden', () => {
  it('主键 + 外部来源就位', () => {
    const g = load('taibu-qimen.json')
    expect(g.reviewed).toBe(false)
    expect(g.source).toContain('taibu-core')
    expect(g.samples.length).toBeGreaterThanOrEqual(2)
  })

  it('定局信息完整：四柱/节气/局式/值符/值使/旬首', () => {
    const g = load('taibu-qimen.json')
    for (const s of g.samples) {
      const info = s['基本信息']
      expect(info['四柱']).toMatch(/[^\s]+ [^\s]+ [^\s]+ [^\s]+/)
      expect(info['节气']).toBeTruthy()
      expect(info['局式']).toMatch(/(阳遁|阴遁)\d+局/)
      expect(info['旬首']).toBeTruthy()
      expect(info['值符']).toBeTruthy()
      expect(info['值使']).toBeTruthy()
    }
  })

  it('盘面完整：九宫皆备，各宫有神/星/门/天干/地盘干', () => {
    const g = load('taibu-qimen.json')
    for (const s of g.samples) {
      expect(s['九宫盘']).toHaveLength(9)
      for (const palace of s['九宫盘']) {
        expect(palace['宫名']).toBeTruthy()
        expect(palace['八神']).toBeTruthy()
        expect(palace['九星']).toBeTruthy()
        expect(palace['八门']).toBeTruthy()
        expect(typeof palace['天盘天干']).toBe('string')
        expect(typeof palace['地盘天干']).toBe('string')
      }
    }
  })
})