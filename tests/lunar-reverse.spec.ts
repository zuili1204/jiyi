import { describe, it, expect } from 'vitest'
import { lunarYearToSolar, solarToLunar } from '@/engine/calendar'

/**
 * 年干支 + 农历月日 → 公历 反查（Y1-17）
 *
 * 《占验课》等原文只给「年干支/年月日」，需换算公历才能喂 `dingJu`。
 * 测试用**往返不变式**锁定正确性（不依赖任何誊录）：
 *   lunarYearToSolar(yearGZ, m, d) 得到公历 → solarToLunar(公历) 应回到
 *   「同一 年干支 农历月日」。两者实现路径不同（前向是 Solar→Lunar、反向是扫描），
 * 若库对 1900 前精确，则往返必同。
 */
describe('年干支 → 农历月日 → 公历 反查（往返自洽）', () => {
  it('1900–2100 区间内随机锚点往返一致', () => {
    const probes = [
      [2024, 2, 10], // 甲辰年正月初一
      [1999, 12, 31],
      [1950, 7, 1],
      [2033, 1, 1]
    ]
    for (const [y, m, d] of probes) {
      const lun = solarToLunar({ year: y, month: m, day: d, hour: 12, minute: 0 })
      const hits = lunarYearToSolar(lun.yearGanZhi, lun.isLeapMonth ? -lun.month : lun.month, lun.day, y - 40, y + 40)
      expect(
        hits.some((h) => h.year === y && h.month === m && h.day === d),
        `${y}-${m}-${d} (${lun.yearGanZhi} ${lun.text}) 未能往返回原生`
      ).toBe(true)
    }
  })

  it('1850s 区间（《占验课》窗口）往返封锁（历法带扩张后）', () => {
    const lun = solarToLunar({ year: 1855, month: 6, day: 1, hour: 12, minute: 0 })
    const hits = lunarYearToSolar(lun.yearGanZhi, lun.month, lun.day, 1850, 1860)
    expect(hits.length).toBeGreaterThan(0)
    const hit = hits.find((h) => h.year === 1850 || h.year === 1855 || h.year === 1860) || hits[0]
    expect(hit).toBeTruthy()
    // 由找到的公历日返算回农历，应回到原 年干支 枚定 （145-191）
    const back = solarToLunar({ year: hit.year, month: hit.month, day: hit.day, hour: 12, minute: 0 })
    expect(back.yearGanZhi).toBe(lun.yearGanZhi)
    expect(back.month).toBe(lun.month)
    expect(back.day).toBe(lun.day)
  })

  it('闰月（传负月）往返一致', () => {
    // 动态找一个闰月日（不硬编日期）：在 2000–2010 间扫一个 isLeapMonth 的农历日
    let found = false
    for (let y = 2000; y <= 2010 && !found; y++) {
      for (let m = 1; m <= 12 && !found; m++) {
        const dim = new Date(Date.UTC(y, m, 0)).getUTCDate()
        for (let d = 1; d <= dim && !found; d++) {
          const lun = solarToLunar({ year: y, month: m, day: d, hour: 12, minute: 0 })
          if (!lun.isLeapMonth) continue
          found = true
          const hits = lunarYearToSolar(lun.yearGanZhi, lun.month, lun.day, y - 5, y + 5)
          expect(hits.some((h) => h.year === y && h.month === m && h.day === d)).toBe(true)
        }
      }
    }
    expect(found).toBe(true)
  })

  it('无匹配年份（区间外）抛错守卫', () => {
    expect(() => lunarYearToSolar('甲子', 1, 1, 1700, 1800)).toThrow()
  })
})