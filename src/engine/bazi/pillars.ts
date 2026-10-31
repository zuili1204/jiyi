import { fourPillars, trueSolarByPlace, type DateTimeInput, type FourPillars } from '@/engine/calendar'

/**
 * 四柱排盘（Y4-01）
 *
 * 纪律：
 * - 只做**排盘**，不做十神 / 格局 / 大运（那是 Y4-02/03/06），更不写断语；
 * - 换年 / 早晚子时 / 闰月三项口径均为**暂定默认**（J14 立春、J7 归当日、J13 节气分段），
 *   必须写进排盘依据，让用户可以核验，而不是藏在代码里；
 * - 真太阳时：出生地命中内置经度表才订正，**未命中不猜**（YR2）—— 宁可不订正，
 *   也不能用一个"看起来合理"的经度把时柱算错。
 */

export interface BaziInput {
  year: number
  month: number // 1-12
  day: number
  hour: number // 0-23
  minute: number
  /** 出生地（用于真太阳时订正）；命不中内置经度表时不订正并标记 */
  place?: string
  gender?: 'male' | 'female'
  /** 是否启用真太阳时订正，默认 true（出生数据类品类的通行做法） */
  useTrueSolar?: boolean
}

export interface TrueSolarInfo {
  /** 合计订正分钟（含均时差） */
  totalMinutes: number
  longitudeMinutes: number
  eotMinutes: number
  /** 订正后时刻文本（便于 UI 直显） */
  correctedText: string
}

export interface BaziPillarsResult {
  pillars: FourPillars
  /** 实际用于排盘的时刻（真太阳时订正后，或原时刻） */
  usedAt: DateTimeInput
  trueSolar?: TrueSolarInfo
  /** 给了出生地但经度表没命中 → true（UI 应引导手填经纬度） */
  placeUnresolved?: boolean
  place?: string
}

function toInput(d: Date): DateTimeInput {
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes()
  }
}

function fmt(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function baziPillars(input: BaziInput): BaziPillarsResult {
  const raw: DateTimeInput = {
    year: input.year,
    month: input.month,
    day: input.day,
    hour: input.hour,
    minute: input.minute
  }
  const base = new Date(input.year, input.month - 1, input.day, input.hour, input.minute)

  const want = input.useTrueSolar !== false && !!input.place
  if (!want) return { pillars: fourPillars(raw), usedAt: raw, place: input.place }

  const ts = trueSolarByPlace(base, input.place!)
  if (!ts) {
    // 经纬度取不到：按原时刻排盘，但**明确标记**，让 UI 提示用户手填
    return { pillars: fourPillars(raw), usedAt: raw, placeUnresolved: true, place: input.place }
  }

  const usedAt = toInput(ts.corrected)
  return {
    pillars: fourPillars(usedAt),
    usedAt,
    trueSolar: {
      totalMinutes: ts.totalMinutes,
      longitudeMinutes: ts.longitudeMinutes,
      eotMinutes: ts.eotMinutes,
      correctedText: fmt(ts.corrected)
    },
    place: input.place
  }
}

/** 四柱文本（便于 UI 与测试） */
export function pillarsText(p: FourPillars): { year: string; month: string; day: string; time: string } {
  return { year: p.year.text, month: p.month.text, day: p.day.text, time: p.time.text }
}
