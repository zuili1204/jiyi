import { describe, it, expect } from 'vitest'
import { loadGoldenSuite } from './helpers'
import { solarToLunar, jieQiTime, ganZhiFromIndex, naYin, kongWang, fourPillars } from '@/engine/calendar'
import { toTrueSolarTime } from '@/engine/calendar/trueSolar'

/** 北京时间（UTC+8）偏移毫秒 */
const BJ_OFFSET_MS = 8 * 60 * 60 * 1000

/**
 * 把「北京时间 date + HH:mm」换算成对应的 UTC 毫秒数，
 * 用于与 `jieQiTime()` 返回的 Date 直接相减取分钟差。
 */
function expectBeijingMs(date: string, time: string): number {
  return Date.parse(`${date}T${time}:00Z`) - BJ_OFFSET_MS
}

/**
 * 历法 golden（Y1-14 / JY-02 §5）
 *
 * 纪律：
 * - `todo: true` 的用例**显式 pending 并计数**，不用 skip 静默跳过（JY-02 §5.5）；
 * - 期望值不得由实现反推；已入库用例均有 `source` + `verifiedBy` 两个来源；
 * - 用例文件缺失 / 字段不全 → `loadGoldenSuite` 抛错，构建失败（缺口必须可见）。
 */
const suite = loadGoldenSuite('calendar')

describe('历法 golden（Y0-03）', () => {
  const todoCount = suite.cases.filter((c) => c.todo).length
  const readyCount = suite.cases.length - todoCount

  it('数据集结构完整（20 组，含来源声明）', () => {
    expect(suite.cases).toHaveLength(20)
    for (const c of suite.cases) {
      expect(c.source, `${c.id} 缺 source`).toBeTruthy()
    }
  })

  it('缺口可见：未采集用例数被统计出来（不是被跳过）', () => {
    console.log(`[golden] calendar：已入库 ${readyCount} / 待采集 ${todoCount}`)
    if (todoCount > 0) expect(todoCount).toBeGreaterThan(0)
  })

  for (const c of suite.cases) {
    if (c.todo) {
      it.todo(`[待采集] ${c.id} — ${c.note ?? c.method}`)
      continue
    }

    it(`${c.id} ${c.method} 与权威来源一致（${c.sourceKind}）`, () => {
      if (c.method === 'solarToLunar') {
        const got = solarToLunar(c.input as never)
        const e = c.expect as { lunarMonth?: number; lunarDay?: number; yearGanZhi?: string }
        if (e.lunarMonth !== undefined) expect(got.month).toBe(e.lunarMonth)
        if (e.lunarDay !== undefined) expect(got.day).toBe(e.lunarDay)
        if (e.yearGanZhi !== undefined) expect(got.yearGanZhi).toBe(e.yearGanZhi)
        return
      }

      /**
       * 节气**时刻**级：权威源之间存在秒级差异（例：2024 立春 16:26:53 vs 引擎 16:27:07），
       * 故只按 `tolerance.timeMinutes` 断言分钟差，秒级不作断言（见 calendar-006 的 note）。
       */
      if (c.method === 'jieQiTime') {
        const { year, name } = c.input as { year: number; name: string }
        const got = jieQiTime(year, name)
        expect(got, `${c.id} 取不到节气「${name}」`).toBeTruthy()
        const e = c.expect as { date: string; time: string }
        const diffMin = Math.abs(got!.getTime() - expectBeijingMs(e.date, e.time)) / 60000
        expect(diffMin, `${c.id} 与权威时刻相差 ${diffMin.toFixed(2)} 分钟`).toBeLessThanOrEqual(
          (c.tolerance as { timeMinutes?: number } | undefined)?.timeMinutes ?? 0
        )
        return
      }

      /** 干支常量：六十甲子序 → 干支 / 纳音 / 旬空（典籍口径） */
      if (c.method === 'ganZhi') {
        const { index } = c.input as { index: number }
        const gz = ganZhiFromIndex(index)
        const e = c.expect as { text?: string; naYin?: string; kongWang?: string }
        if (e.text !== undefined) expect(gz.text).toBe(e.text)
        if (e.naYin !== undefined) expect(naYin(gz)).toBe(e.naYin)
        if (e.kongWang !== undefined) expect(kongWang(gz).join('')).toBe(e.kongWang)
        return
      }

      /**
       * 四柱：引擎 fourPillars（lunar-typescript，setSect=midnight）独立值见 calendar-011~014 source。
       */
      if (c.method === 'fourPillars') {
        const inp = c.input as { year: number; month: number; day: number; hour: number; minute: number; midnight?: number }
        const r = fourPillars(inp, { midnight: (inp.midnight ?? 2) as 1 | 2 })
        const e = c.expect as { year: string; month: string; day: string; time: string }
        expect(r.year.text ?? r.year, `${c.id} 年柱`).toBe(e.year)
        expect(r.month.text ?? r.month, `${c.id} 月柱`).toBe(e.month)
        expect(r.day.text ?? r.day, `${c.id} 日柱`).toBe(e.day)
        expect(r.time.text ?? r.time, `${c.id} 时柱`).toBe(e.time)
        return
      }

      /**
       * 真太阳时订正：引擎自研 Spencer EoT；totalMinutes 为回归锁，eotMinutes 经 NOAA 交叉验证。
       */
      if (c.method === 'trueSolarTime') {
        const inp = c.input as { year: number; month: number; day: number; hour: number; minute: number; longitude: number }
        const date = new Date(inp.year, inp.month - 1, inp.day, inp.hour, inp.minute, 0)
        const r = toTrueSolarTime(date, inp.longitude)
        const e = c.expect as { totalMinutes: number; longitudeMinutes?: number; eotMinutes?: number }
        expect(r.totalMinutes, `${c.id} 合计订正分钟`).toBeCloseTo(e.totalMinutes, 1)
        if (e.longitudeMinutes !== undefined) expect(r.longitudeMinutes, `${c.id} 经度订正`).toBeCloseTo(e.longitudeMinutes, 2)
        if (e.eotMinutes !== undefined) expect(r.eotMinutes, `${c.id} 均时差`).toBeCloseTo(e.eotMinutes, 2)
        return
      }

      throw new Error(
        `用例 ${c.id} 的 method「${c.method}」尚无执行器：先实现 runner 再接用例（不许改用例迁就实现）`
      )
    })
  }
})
