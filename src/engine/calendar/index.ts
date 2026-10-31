import { Lunar, Solar } from 'lunar-typescript'
import {
  CALENDAR_MAX_YEAR,
  CALENDAR_MIN_YEAR,
  DI_ZHI,
  JIA_ZI_60,
  NA_YIN,
  TIAN_GAN,
  type DiZhi,
  type MidnightPolicy,
  type TianGan,
  type WuXing
} from './constants'

/**
 * 历法底座（JY-02 §2 / JY-03 §3）
 *
 * 底层：lunar-typescript v1.8.6（MIT），选型结论见 JY-02 §4.4。
 *
 * 必须遵守的两条使用约束（踩过的坑，见 JY-02 §4.4）：
 * 1. getJieQiTable() 是 31 项滑动窗口，且中英文键并存 → 取某年节气必须按年份二次过滤。
 * 2. 早晚子时口径统一由 MidnightPolicy 传入，禁止散落硬编码。
 */

export * from './constants'
export * from './trueSolar'
export { findDayGanZhi, findDayGanZhiText, lunarYearToSolar } from './reverse'
export type { GanZhiDayHit, LunarYearSolar } from './reverse'

export interface CalendarError {
  code: 'OUT_OF_RANGE' | 'INVALID_INPUT'
  message: string
}

/** 区间硬拦截：超出即抛错，不返回"看起来合理的错值"（YR1） */
export function assertInRange(year: number): void {
  if (!Number.isInteger(year)) throw new Error(`年份必须是整数，收到 ${year}`)
  if (year < CALENDAR_MIN_YEAR || year > CALENDAR_MAX_YEAR) {
    throw new Error(
      `超出支持区间（${CALENDAR_MIN_YEAR}–${CALENDAR_MAX_YEAR}）：${year}。本应用不对区间外结果做保证。`
    )
  }
}

export interface DateTimeInput {
  year: number
  month: number // 1-12
  day: number // 1-31
  hour: number // 0-23
  minute: number // 0-59
  second?: number
}

// ---------------------------------------------------------------- 干支 / 纳音 / 空亡

export interface GanZhi {
  gan: TianGan
  zhi: DiZhi
  /** 六十甲子序号 0-59 */
  index: number
  text: string
}

export function makeGanZhi(gan: TianGan, zhi: DiZhi): GanZhi {
  const gi = TIAN_GAN.indexOf(gan)
  const zi = DI_ZHI.indexOf(zhi)
  if (gi < 0 || zi < 0) throw new Error(`非法干支：${gan}${zhi}`)
  // 六十甲子序号：满足 (i % 10 === gi && i % 12 === zi)
  let index = -1
  for (let i = gi; i < 60; i += 1) {
    if (i % 10 === gi && i % 12 === zi) {
      index = i
      break
    }
  }
  if (index < 0) throw new Error(`干支组合不存在：${gan}${zhi}（阴阳不配）`)
  return { gan, zhi, index, text: `${gan}${zhi}` }
}

export function ganZhiFromIndex(index: number): GanZhi {
  const i = ((index % 60) + 60) % 60
  return makeGanZhi(TIAN_GAN[i % 10], DI_ZHI[i % 12])
}

export function ganZhiFromText(text: string): GanZhi {
  if (text.length !== 2) throw new Error(`干支必须是两个字：${text}`)
  return makeGanZhi(text[0] as TianGan, text[1] as DiZhi)
}

/** 纳音五行名（每两组干支共一纳音） */
export function naYin(gz: GanZhi): string {
  return NA_YIN[Math.floor(gz.index / 2)]
}

/** 纳音对应的五行：取纳音名最后一个字（金木水火土） */
export function naYinWuXing(gz: GanZhi): WuXing {
  const name = naYin(gz)
  const last = name[name.length - 1]
  const map: Record<string, WuXing> = {
    金: 'metal',
    木: 'wood',
    水: 'water',
    火: 'fire',
    土: 'earth'
  }
  const w = map[last]
  if (!w) throw new Error(`无法解析纳音五行：${name}`)
  return w
}

/**
 * 旬空（空亡）：以日柱干支所在旬为准。
 * 每旬 10 个干支，天干余 2 个地支即为空亡。
 */
export function kongWang(gz: GanZhi): [DiZhi, DiZhi] {
  const xunIndex = Math.floor(gz.index / 10) // 0-5
  const startZhiIndex = (xunIndex * 10) % 12
  const unused: DiZhi[] = []
  for (let i = 0; i < 12; i++) {
    const zi = (startZhiIndex + i) % 12
    const inXun = Array.from({ length: 10 }, (_, k) => (startZhiIndex + k) % 12).includes(zi)
    if (!inXun) unused.push(DI_ZHI[zi])
  }
  if (unused.length !== 2) throw new Error(`空亡计算异常：${gz.text} → ${unused.join('')}`)
  return [unused[0], unused[1]]
}

// ---------------------------------------------------------------- 农历 / 公历

export interface LunarInfo {
  year: number
  month: number // 正负数，负数为闰月
  day: number
  /** 中文描述，例：二〇二四年正月初一 */
  text: string
  isLeapMonth: boolean
  /** 农历年干支 */
  yearGanZhi: string
}

export function solarToLunar(d: DateTimeInput): LunarInfo {
  assertInRange(d.year)
  const lunar = Solar.fromYmdHms(
    d.year,
    d.month,
    d.day,
    d.hour,
    d.minute,
    d.second ?? 0
  ).getLunar()
  const month = lunar.getMonth()
  return {
    year: lunar.getYear(),
    month,
    day: lunar.getDay(),
    text: lunar.toString(),
    isLeapMonth: month < 0,
    yearGanZhi: lunar.getYearInGanZhi()
  }
}

// ---------------------------------------------------------------- 节气

/**
 * 取某自然年的某个节气时刻。
 *
 * 注意：lunar-typescript 的 getJieQiTable() 是滑动窗口且中英文键并存，
 * 因此必须按年份二次过滤，不能假设 24 个中文键属于同一年（JY-02 §4.4 坑 1）。
 */
export function jieQiTime(year: number, name: string): Date | undefined {
  assertInRange(year)
  /**
   * 注意：底层库的 `getJieQiTable()` 是**滑动窗口**，不是"某自然年的 24 节气"。
   * 以某年 6 月 1 日为锚点时，窗口约为「上一年的冬至 → 本年的大雪」——
   * 因此**本年的冬至不在这个窗口里**（实测 2025 / 2026 / 2027 三年都取不到冬至，而大雪能取到）。
   *
   * 后果：只看一个窗口会让 12 月下旬取不到冬至，奇门定局会被判成大雪 → 阴阳遁反了。
   * 修法：再锚一次 year+1（其窗口起点正是本年的冬至），并按目标年份过滤。
   * 各节气在不同窗口里不重叠（窗口边界是冬至/大雪），所以不会取重。
   */
  const anchors = [year, year + 1, year - 1].filter(
    (y) => y >= CALENDAR_MIN_YEAR && y <= CALENDAR_MAX_YEAR
  )
  for (const anchor of anchors) {
    const table = Solar.fromYmdHms(anchor, 6, 1, 12, 0, 0).getLunar().getJieQiTable() as Record<
      string,
      Solar
    >
    for (const [key, solar] of Object.entries(table)) {
      if (key !== name) continue // 只认中文键，跳过 LI_CHUN 之类拼音键
      if (solar.getYear() !== year) continue
      const [hh, mm, ss] = [solar.getHour(), solar.getMinute(), solar.getSecond()]
      return new Date(year, solar.getMonth() - 1, solar.getDay(), hh, mm, ss)
    }
  }
  return undefined
}

/** 某自然年的全部 24 节气（按时间升序，缺失项为 null） */
export function jieQiTableOfYear(
  year: number,
  names: readonly string[]
): Record<string, Date | null> {
  const out: Record<string, Date | null> = {}
  for (const n of names) out[n] = jieQiTime(year, n) ?? null
  return out
}

// ---------------------------------------------------------------- 四柱

export interface FourPillars {
  year: GanZhi
  month: GanZhi
  day: GanZhi
  time: GanZhi
}

/**
 * 排四柱。
 *
 * 依赖底层库按节气分界（换月以节、换年由 NewYearPolicy 决定）。
 * 早晚子时口径由 MidnightPolicy 控制（对应库 EightChar.setSect）。
 */
export function fourPillars(
  d: DateTimeInput,
  opts: { midnight?: MidnightPolicy } = {}
): FourPillars {
  assertInRange(d.year)
  const lunar = Solar.fromYmdHms(
    d.year,
    d.month,
    d.day,
    d.hour,
    d.minute,
    d.second ?? 0
  ).getLunar()
  const ec = lunar.getEightChar()
  ec.setSect(opts.midnight ?? 2)
  return {
    year: ganZhiFromText(ec.getYear()),
    month: ganZhiFromText(ec.getMonth()),
    day: ganZhiFromText(ec.getDay()),
    time: ganZhiFromText(ec.getTime())
  }
}

/** 六十甲子表（便于 UI 与调试） */
export const JIA_ZI_TABLE = JIA_ZI_60

export type { Lunar, Solar }
