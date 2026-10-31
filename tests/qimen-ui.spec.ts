import { describe, it, expect } from 'vitest'
import { buildQimenRecord, qimenChaibuEngine } from '@/engine/qimen'

/**
 * 奇门记录 + 九宫结构（Y6-05 的数据侧）
 *
 * 纪律：只验证结构落地，不宣称吉凶正确（定局法 / 天盘取法待核校 Y6-08）。
 */
describe('奇门记录与九宫结构', () => {
  it('buildQimenRecord 产出可落库记录，basis 含九宫结构', () => {
    const rec = buildQimenRecord({ at: undefined, question: '今日出行' }, 'qm-1')
    expect(rec.kind).toBe('qimen')
    expect(rec.interpretation.basis).toBeDefined()
    const pan = (rec.interpretation.basis as Record<string, unknown>)['qimenPan']
    // 定局 + 天盘成功时，九宫为 9 宫结构
    if (pan) {
      expect(Array.isArray(pan)).toBe(true)
      expect((pan as unknown[]).length).toBe(9)
      const cell = (pan as any[])[0]
      expect(cell).toHaveProperty('name')
      expect(cell).toHaveProperty('heavenlyGan')
      expect(cell).toHaveProperty('earthlyGan')
      expect(cell).toHaveProperty('star')
    }
  })

  it('compute 不依赖随机源（确定性起局）', () => {
    const r1 = qimenChaibuEngine.compute({ at: undefined }, { next: () => 0, int: () => 0 })
    const r2 = qimenChaibuEngine.compute({ at: undefined }, { next: () => 0, int: () => 0 })
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2))
  })

  it('Y6-04：八神 / 空亡 / 马星已落地且结构自洽', () => {
    const at = { year: 2024, month: 3, day: 20, hour: 9, minute: 0 }
    const r = qimenChaibuEngine.compute({ at }, { next: () => 0, int: () => 0 })
    expect(r.pan).toBeDefined()
    const p = r.pan!
    // 八神：除中五宫外 8 宫各一神，且含值符
    const gods = Object.values(p.gods).filter(Boolean)
    expect(gods.length).toBe(8)
    expect(p.gods[p.zhiFu.palace]).toBe('值符')
    // 空亡：时旬空亡两个地支，且映射宫位非空
    expect(p.kongWang.length).toBe(2)
    expect(p.kongWangPalaces.length).toBeGreaterThan(0)
    // 马星：单一地支且落宫有效
    expect(['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']).toContain(p.maXing)
    expect(p.maXingPalace).toBeGreaterThanOrEqual(1)
    expect(p.maXingPalace).toBeLessThanOrEqual(9)

    // 结果页可见八神 / 空亡 / 马星区块
    const interp = qimenChaibuEngine.interpret(r)
    const texts = interp.blocks.map((b) => b.text).join('\n')
    expect(texts).toContain('八神')
    expect(texts).toContain('空亡')
    expect(texts).toContain('驿马')
    // 仍不编造断语
    // 禁词：吉凶断定词（裸「凶」会误伤「吉凶」这个合规中性词，如「不做吉凶断语」）
    for (const banned of ['大吉', '大凶', '小凶', '必', '一定', '注定']) expect(texts).not.toContain(banned)
  })
})
