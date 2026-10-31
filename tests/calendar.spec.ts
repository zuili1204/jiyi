import { describe, it, expect } from 'vitest'
import {
  assertInRange,
  fourPillars,
  ganZhiFromText,
  kongWang,
  naYin,
  naYinWuXing,
  makeGanZhi,
  CALENDAR_MIN_YEAR,
  CALENDAR_MAX_YEAR,
  JIA_ZI_TABLE
} from '@/engine/calendar'
import { toTrueSolarTime, equationOfTime, longitudeCorrection } from '@/engine/calendar/trueSolar'

describe('历法常量层', () => {
  it('六十甲子共 60 项且无重复', () => {
    expect(JIA_ZI_TABLE).toHaveLength(60)
    expect(new Set(JIA_ZI_TABLE).size).toBe(60)
  })

  it('干支构造：甲子旬空戌亥', () => {
    const gz = makeGanZhi('甲', '子')
    const [a, b] = kongWang(gz)
    expect([a, b]).toEqual(['戌', '亥'])
  })

  it('干支构造：甲戌旬空申酉', () => {
    const [a, b] = kongWang(ganZhiFromText('甲戌'))
    expect([a, b]).toEqual(['申', '酉'])
  })

  it('阴阳不配的干支组合报错误', () => {
    expect(() => makeGanZhi('甲', '丑')).toThrow()
  })

  it('纳音：甲子 → 海中金（金）', () => {
    const gz = ganZhiFromText('甲子')
    expect(naYin(gz)).toBe('海中金')
    expect(naYinWuXing(gz)).toBe('metal')
  })
})

describe('区间硬拦截', () => {
  it('区间内不抛错', () => {
    expect(() => assertInRange(2024)).not.toThrow()
  })
  it('区间外抛错', () => {
    expect(() => assertInRange(1849)).toThrow()
    expect(() => assertInRange(2150)).toThrow()
  })
  it('非整数抛错', () => {
    expect(() => assertInRange(2024.5)).toThrow()
  })
  it('常量边界正确（下界 Y1-16 放宽到 1850）', () => {
    expect(CALENDAR_MIN_YEAR).toBe(1850)
    expect(CALENDAR_MAX_YEAR).toBe(2100)
  })
})

describe('四柱（依赖 lunar-typescript，精度待验证）', () => {
  it('2024-02-10 12:00 日柱为甲辰', () => {
    const fp = fourPillars({ year: 2024, month: 2, day: 10, hour: 12, minute: 0 })
    expect(fp.day.text).toBe('甲辰')
  })

  it('早晚子时口径：策略确实改变 23:30 的日柱（库实测语义）', () => {
    // 测得：sect=1 → 晚子时归次日（日柱进一天）；sect=2 → 归当日（日柱不变）
    const nightSameDay = fourPillars(
      { year: 2024, month: 2, day: 10, hour: 23, minute: 30 },
      { midnight: 2 }
    )
    const nightNextDay = fourPillars(
      { year: 2024, month: 2, day: 10, hour: 23, minute: 30 },
      { midnight: 1 }
    )
    const nextDayMid = fourPillars({ year: 2024, month: 2, day: 11, hour: 0, minute: 30 })
    // sect=2（归当日）：日柱 = 甲辰（2/10 当日）
    expect(nightSameDay.day.text).toBe('甲辰')
    // sect=1（归次日）：日柱 = 乙巳（2/11 次日），与 0:30 一致
    expect(nightNextDay.day.text).toBe('乙巳')
    expect(nightNextDay.day.text).toBe(nextDayMid.day.text)
  })
})

describe('真太阳时', () => {
  it('经度订正：东经 120 时差为 0', () => {
    expect(longitudeCorrection(120)).toBe(0)
  })
  it('经度订正：东经 116 约 -16 分钟', () => {
    expect(longitudeCorrection(116)).toBeCloseTo(-16, 5)
  })
  it('均时差在 ±17 分钟量级', () => {
    const cases = [0, 90, 180, 270, 360]
    for (const d of cases) {
      const v = equationOfTime(new Date(2024, 0, 1 + d))
      expect(Math.abs(v)).toBeLessThan(17)
    }
  })
  it('订正后时刻 = 原时刻 + 合计分钟', () => {
    const date = new Date(2024, 5, 1, 12, 0, 0)
    const r = toTrueSolarTime(date, 116)
    expect(r.totalMinutes).toBeCloseTo(r.longitudeMinutes + r.eotMinutes, 1)
    expect(r.corrected.getTime() - date.getTime()).toBeCloseTo(r.totalMinutes * 60000, 0)
  })
})
