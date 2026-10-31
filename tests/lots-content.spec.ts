import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  lotsEngine,
  setLotsContentProvider,
  type LotsContentEntry,
  type LotKind
} from '@/engine/lots'
import { guanyinLotsEntries, getLotEntry, LOT_KINDS } from '@/data/content/lots'

/**
 * 签占内容包（Y2-02 首三套：观音 / 关帝 / 吕祖）
 * 覆盖：完整性、结构（签诗/解曰/出处齐全）、引擎按套系路由、golden 回归。
 */
const ALL_KINDS = LOT_KINDS.map((k) => k.kind)

describe('签占内容包（Y2-02 首三套）', () => {
  beforeEach(() => setLotsContentProvider((index: number, kind?: string) => getLotEntry(index, (kind as LotKind) ?? 'guanyin')))
  afterEach(() => setLotsContentProvider(null))

  for (const kind of ALL_KINDS) {
    it(`[${kind}] 完整 100 签，签号 1–100 齐全且不重复`, () => {
      const entries = Array.from({ length: 100 }, (_, i) => getLotEntry(i + 1, kind))
      expect(entries).toHaveLength(100)
      for (const e of entries) expect(e).toBeDefined()
      const idx = entries.map((e) => e!.index).sort((a, b) => a - b)
      expect(idx).toEqual(Array.from({ length: 100 }, (_, i) => i + 1))
    })

    it(`[${kind}] 每条均含签诗、解曰与可审计的出处（source.name / license）`, () => {
      for (let n = 1; n <= 100; n++) {
        const e = getLotEntry(n, kind)!
        expect(e.poem && e.poem.length > 0).toBe(true)
        expect(e.prose && e.prose.length > 0).toBe(true)
        expect(e.source?.name).toBeTruthy()
        expect(e.source?.license).toBeTruthy()
      }
    })
  }

  it('引擎按 kind 路由到对应套系母版（不串签）', () => {
    const g = lotsEngine.interpret({ index: 1, kind: 'guanyin' })
    const d = lotsEngine.interpret({ index: 1, kind: 'guandi' })
    const l = lotsEngine.interpret({ index: 1, kind: 'lvzu' })
    expect(g.degraded).toBeUndefined()
    expect(g.blocks.find((b) => b.key === 'poem')?.text).toContain('开天辟地作良缘')
    expect(d.blocks.find((b) => b.key === 'poem')?.text).toContain('巍巍独步向云间')
    expect(l.blocks.find((b) => b.key === 'poem')?.text).toContain('蓬莱东阁玉桃香')
    // 三套首签签诗互不相同
    expect(g.blocks.find((b) => b.key === 'poem')?.text).not.toBe(d.blocks.find((b) => b.key === 'poem')?.text)
  })

  // 轻量回归校验（独立权威 golden 核验见 Y0-03）
  const golden: Record<LotKind, { n: number; head: string; story?: string }> = {
    guanyin: { n: 1, head: '开天辟地作良缘', story: '钟离成道' },
    guandi: { n: 1, head: '巍巍独步向云间' },
    lvzu: { n: 1, head: '蓬莱东阁玉桃香', story: '王母祝寿' }
  }
  for (const kind of ALL_KINDS) {
    it(`[${kind}] 已知签号签诗/典故与采集源一致`, () => {
      const exp = golden[kind]
      const entry: LotsContentEntry | undefined = getLotEntry(exp.n, kind)
      expect(entry).toBeDefined()
      expect(entry!.poem!.startsWith(exp.head)).toBe(true)
      if (exp.story !== undefined) expect(entry!.story).toBe(exp.story)
    })
  }

  it('观音原有条目（向后兼容）仍为 100 且首签典故正确', () => {
    expect(guanyinLotsEntries).toHaveLength(100)
    expect(getLotEntry(1, 'guanyin')!.story).toBe('钟离成道')
  })

  // 吕祖传统无等级，等级由签文推断补全；此测试固化「100 签均无空缺」的不变量
  const LVZU_GRADES = /大吉|上上|上吉|中吉|中平|中下|下下/
  it('[lvzu] 100 签均已补全吉凶等级（推断者标注（推断），无空缺）', () => {
    for (let n = 1; n <= 100; n++) {
      const e = getLotEntry(n, 'lvzu')!
      expect(e.title).toContain('·') // 标题含等级后缀
      expect(e.title).toMatch(LVZU_GRADES)
    }
  })
})
