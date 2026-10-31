import { describe, it, expect } from 'vitest'
import { computeRelations, computeShenSha } from '@/engine/bazi'
import type { FourPillars } from '@/engine/calendar'
import { ganZhiFromText } from '@/engine/calendar'

const P = (o: Partial<Record<'year' | 'month' | 'day' | 'time', string>>): FourPillars => {
  const mk = (t?: string) => (t ? ganZhiFromText(t) : ganZhiFromText('甲子'))
  return { year: mk(o.year), month: mk(o.month), day: mk(o.day), time: mk(o.time) }
}

describe('干支刑冲合害（Y4-08 旁参）', () => {
  it('六冲：子 与 午 相冲', () => {
    const r = computeRelations(P({ year: '甲子', day: '甲午' }))
    expect(r.liuChong.some((x) => x.a === '子' && x.b === '午')).toBe(true)
  })

  it('六合：子 与 丑 相合', () => {
    const r = computeRelations(P({ year: '甲子', day: '乙丑' }))
    expect(r.liuHe.some((x) => [x.a, x.b].sort().join('') === '丑子')).toBe(true)
  })

  it('天干五合：甲 与 己 合', () => {
    const r = computeRelations(P({ year: '甲子', month: '己丑' }))
    expect(r.wuHe.length).toBeGreaterThan(0)
  })

  /**
   * 2026-09-23 翻转：关系表（六合/六冲/六害/三合/三刑·自刑/五合）已由 golden
   * `bazi-021~026` 核校通过 → `reviewed: true`。
   * ⚠️ 转正**不含**神煞与「半合是否同列三合」口径，二者仍待核校。
   */
  it('关系表已核验（reviewed:true，依据见 RELATIONS_REVIEWED）', () => {
    const r = computeRelations(P({}))
    expect(r.reviewed).toBe(true)
  })
})

describe('神煞（旁参，不混子平取格）', () => {
  it('命中的神煞 branch 必属四柱地支', () => {
    const p = P({ year: '甲子', month: '丙寅', day: '甲午', time: '壬戌' })
    const zhis = [p.year.zhi, p.month.zhi, p.day.zhi, p.time.zhi]
    for (const s of computeShenSha(p)) {
      expect(zhis).toContain(s.branch)
    }
  })
})