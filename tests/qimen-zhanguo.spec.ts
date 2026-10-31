import { describe, it, expect } from 'vitest'
import { fourPillars, findDayGanZhi, findDayGanZhiText, solarToLunar } from '@/engine/calendar'
import { dingJu } from '@/engine/qimen'

/**
 * 《奇门而也·占验课》对接探针（Y6-08）
 *
 * 目的：验证「干支纪日 → 公历反查 → 定局」这条核校链路能走通，
 * 并**如实暴露**《占役课》案例所在窗口（1853–1892）在历法保证区间之外、无法可靠反推
 * 这一硬约束 —— 宁可拒绝，不做语义跳跃（YR1）。
 */
describe('《占验课》反查 → 定局链路（探测）', () => {
  it('Y1-16 扩容后 1853–1892 不再被拒：反查能出结果（历法下界 1900→1850）', () => {
    // 定局依赖节气 + 四柱日干支（公式推导），Y1-16 实测 1900 前精确（见逆向测试与实测）。
    const hits = findDayGanZhiText(1853, 1892, '庚午')
    expect(hits.length).toBeGreaterThan(0)
    // 春节/立春所在带外不再是 ER；能正向走丁局
    const j = dingJu({ year: 1870, month: 3, day: 15, hour: 12, minute: 0 })
    expect(j).toBeDefined()
  })

  it('链路可用性探测：区内(1900–2100)日干支 → 反查 → 定局（不崩溃、能产出）', () => {
    const gz = fourPillars({ year: 2024, month: 2, day: 10, hour: 12, minute: 0 })
    const hits = findDayGanZhi(2024, 2024, gz.day.gan, gz.day.zhi)
    expect(hits.length).toBeGreaterThan(0)
    for (const h of hits.slice(0, 3)) {
      const j = dingJu({ year: h.year, month: h.month, day: h.day, hour: 12, minute: 0 })
      if (j) {
        expect(j.ju).toBeGreaterThanOrEqual(1)
        expect(j.ju).toBeLessThanOrEqual(9)
      }
    }
  })

  it('农历复核：反查命中与 solarToLunar 一致', () => {
    const gz = fourPillars({ year: 2024, month: 2, day: 10, hour: 12, minute: 0 })
    const hits = findDayGanZhi(2024, 2024, gz.day.gan, gz.day.zhi)
    const h = hits.find((x) => x.month === 2 && x.day === 10)!
    const lunar = solarToLunar({ year: 2024, month: 2, day: 10, hour: 12, minute: 0 })
    expect(h.isLeapMonth).toBe(lunar.isLeapMonth)
    expect(h.lunarDay).toBe(lunar.day)
  })
})