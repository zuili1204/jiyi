import { describe, it, expect } from 'vitest'
import { findDayGanZhi, findDayGanZhiText, fourPillars, solarToLunar } from '@/engine/calendar'

/**
 * 干支纪日 → 公历 反查（Y1-15）
 *
 * 正确性基准是「往返自洽」：先取 N 个公历日，用 `fourPillars` 求其日干支，
 * 再用反查把它找回来；并用 `solarToLunar` 复核命中的农历月日与原始日一致。
 * 再验证 60 天循环计数、非法入参抛错、超支持区间抛错。
 */
describe('干支纪日 → 公历 反查', () => {
  it('反查能找回给定公历日的日干支（多个锚点往返自洽）', () => {
    const anchors: [number, number, number][] = [
      [2024, 2, 10],
      [2024, 3, 3],
      [2025, 1, 1],
      [1999, 12, 31]
    ]
    for (const [y, m, d] of anchors) {
      const gz = fourPillars({ year: y, month: m, day: d, hour: 12, minute: 0 })
      const hits = findDayGanZhi(y, y, gz.day.gan, gz.day.zhi)
      expect(
        hits.some((h) => h.year === y && h.month === m && h.day === d),
        `${y}-${m}-${d} 未在 ${gz.day.text} 的命中集中`
      ).toBe(true)
      // 农历复核：命中日的农历月日与原日一致
      const lunar = solarToLunar({ year: y, month: m, day: d, hour: 12, minute: 0 })
      const hit = hits.find((h) => h.year === y && h.month === m && h.day === d)!
      expect(hit.lunarDay).toBe(lunar.day)
      expect(hit.isLeapMonth).toBe(lunar.isLeapMonth)
    }
  })

  it('一年内某日干支命中约 6 次（60 天旬际）', () => {
    const gz = fourPillars({ year: 2024, month: 3, day: 3, hour: 12, minute: 0 })
    const hits = findDayGanZhi(2024, 2024, gz.day.gan, gz.day.zhi)
    expect(hits.length).toBeGreaterThanOrEqual(5)
    expect(hits.length).toBeLessThanOrEqual(7)
  })

  it('二字日干支文本入口等价', () => {
    const gz = fourPillars({ year: 2024, month: 3, day: 3, hour: 12, minute: 0 })
    const a = findDayGanZhi(2024, 2024, gz.day.gan, gz.day.zhi)
    const b = findDayGanZhiText(2024, 2024, `${gz.day.gan}${gz.day.zhi}`)
    expect(a.map((h) => `${h.year}-${h.month}-${h.day}`)).toEqual(
      b.map((h) => `${h.year}-${h.month}-${h.day}`)
    )
  })

  it('非法输入抛错', () => {
    expect(() => findDayGanZhiText(2024, 2024, '庚')).toThrow()
    expect(() => findDayGanZhi(1849, 2024, '庚', '午')).toThrow() // 低于支持下界(1850)
    expect(() => findDayGanZhi(2024, 2101, '庚', '午')).toThrow() // 高于支持上界
  })
})