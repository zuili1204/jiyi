import { describe, it, expect } from 'vitest'
import { ziweiPalaceItems, getPalaceStarEntry, getPalaceDualEntry, ZIWEI_PALACE_META } from '@/data/content/ziwei'
import { buildZiweiRecord, ZIWEI_GONG_ORDER } from '@/engine/ziwei'
import { bootstrapContent } from '@/data/content/bootstrap'

/**
 * 星宫组合母版（Y5-07）：14 主星 × 12 宫 + 12 双星 × 12 宫 = 312 条，全中性参考。
 *
 * 纪律：母版为**本产品自撰中性参考**（`reviewed:false` 待核校），此处只测「齐全 / 唯一」；
 * 措辞合规性由 `content:sync` 内容闸与 `content-gate.spec.ts` 把关，本测试不重复扫词。
 */

const GONGS = [...ZIWEI_GONG_ORDER]

describe('星宫组合母版齐全（Y5-07）', () => {
  it('总数 312：单星 168 + 双星 144', () => {
    const singles = ziweiPalaceItems.filter((i) => i.kind === 'single')
    const duals = ziweiPalaceItems.filter((i) => i.kind === 'dual')
    expect(ziweiPalaceItems.length).toBe(312)
    expect(singles.length).toBe(168) // 14 × 12
    expect(duals.length).toBe(144) // 12 × 12
  })

  it('id 唯一', () => {
    const ids = ziweiPalaceItems.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('十二宫各宫均可查取单星条目（以紫微为样本）+ 主星覆盖 14 颗', () => {
    for (const gong of GONGS) {
      expect(getPalaceStarEntry('紫微', gong)).toBeDefined()
    }
    const stars = new Set(
      ziweiPalaceItems.filter((i) => i.kind === 'single').map((i) => i.star)
    )
    expect(stars.size).toBe(14)
  })

  it('双星条目（紫微天府）× 12 宫', () => {
    for (const gong of GONGS) {
      expect(getPalaceDualEntry('紫微天府', gong)).toBeDefined()
    }
  })

  it('meta：reviewed false 且 source/license/school 齐全', () => {
    expect(ZIWEI_PALACE_META.reviewed).toBe(false)
    expect(ZIWEI_PALACE_META.source.length).toBeGreaterThan(0)
    expect(ZIWEI_PALACE_META.license.length).toBeGreaterThan(0)
    expect(ZIWEI_PALACE_META.school.length).toBeGreaterThan(0)
  })
})

describe('引擎注入与结果页（Y5-07 接入）', () => {
  it('bootstrapContent 注入后出现「星宫参考」块且为中性文案', () => {
    bootstrapContent()
    const rec = buildZiweiRecord(
      { year: 1990, month: 6, day: 15, hour: 14, minute: 30 },
      'zv-ps'
    )
    const texts = rec.interpretation.blocks.map((b) => b.text).join('\n')
    expect(rec.interpretation.blocks.some((b) => b.key === 'palaceReference')).toBe(true)
    expect(texts).toContain('非定论')
    for (const banned of ['必', '一定', '注定', '大吉', '血光']) {
      expect(texts).not.toContain(banned)
    }
  })
})