import { Solar } from 'lunar-typescript'
import { assertInRange } from './index'

/**
 * 干支纪日 → 公历日期 反查（Y1-15 / 奇门 golden 前置）
 *
 * 用途：把权威来源（如《奇门旨归·占验课》）给出的**干支纪日 + 时辰**，
 * 在一个公历年份窗口内反查出对应的公历日期，以喂给 `dingJu` / `fourPillars`
 * 做定局核校。这是「从语录到可测公历」的关键一步。
 *
 * 纪律：
 * - 日干支以「农历日柱」为准（与 `fourPillars().day` 同源，底层 lunar-typescript）；
 * - 一个日干支每 60 天循环一次，窗口越大命中越多；**仅给日干支无法唯一锁定**，
 *   需配合公历（或年干支 + 农历月）才可收窄 —— 这点在文档里如实标注。
 */

export interface GanZhiDayHit {
  year: number
  month: number
  day: number
  /** 农历月日（负月 = 闰月，与 `solarToLunar` 一致） */
  lunarMonth: number
  lunarDay: number
  isLeapMonth: boolean
}

/**
 * 候选公历年区间内，反查出所有「日干=gan、日支=zhi」的公历日期。
 *
 * @param fromYear 含（闭区间低界）
 * @param toYear   含（闭区间高界）
 * @param gan  天干（如 '庚'）
 * @param zhi  地支（如 '午'）
 */
export function findDayGanZhi(
  fromYear: number,
  toYear: number,
  gan: string,
  zhi: string
): GanZhiDayHit[] {
  assertInRange(fromYear)
  assertInRange(toYear)
  const out: GanZhiDayHit[] = []
  for (let y = fromYear; y <= toYear; y++) {
    for (let m = 1; m <= 12; m++) {
      const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
      for (let dd = 1; dd <= daysInMonth; dd++) {
        const lunar = Solar.fromYmd(y, m, dd).getLunar()
        if (lunar.getDayInGanZhi() === `${gan}${zhi}`) {
          out.push({
            year: y,
            month: m,
            day: dd,
            lunarMonth: lunar.getMonth(),
            lunarDay: lunar.getDay(),
            isLeapMonth: lunar.getMonth() < 0
          })
        }
      }
    }
  }
  return out
}

/** 按「二字干支」反查（与 `ganZhiFromText` 同入参习惯） */
export function findDayGanZhiText(
  fromYear: number,
  toYear: number,
  dayText: string
): GanZhiDayHit[] {
  if (dayText.length !== 2) throw new Error(`日干支必须是两个字：${dayText}`)
  return findDayGanZhi(fromYear, toYear, dayText[0], dayText[1])
}

export interface LunarYearSolar {
  year: number
  month: number
  day: number
}

/**
 * 【年干支 + 农历月日 → 公历】（唯一定公历日的基础）
 *
 * 用途：《占验课》25 例其它只给「年干支 + 农历月日 + 时辰」，没有公历。此函数按
 * 农历年（以该历法所定义的该农历年内的公历分布）扫描，返回满足「年干支∧月∧日」的
 * 公历日。闭环自洽（与 `solarToLunar` 往返）由测试保证，不依赖我或任何誊录。
 *
 * @param yearGZ 农历年干支，如 '乙卯'
 * @param month  农历月（正数；闰月传负，如闰四月=-4）
 * @param day    农历日（1-30）
 * @param from   公历搜索窗口下界（含）
 * @param to     公历搜索窗口上界（含）
 */
export function lunarYearToSolar(
  yearGZ: string,
  month: number,
  day: number,
  fromYear: number,
  toYear: number
): LunarYearSolar[] {
  assertInRange(fromYear)
  assertInRange(toYear)
  const out: LunarYearSolar[] = []
  for (let y = fromYear; y <= toYear; y++) {
    for (let m = 1; m <= 12; m++) {
      const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
      for (let d = 1; d <= daysInMonth; d++) {
        const lunar = Solar.fromYmd(y, m, d).getLunar()
        if (lunar.getYearInGanZhi() !== yearGZ) continue
        // month 入参：闰月为负（如闰四月=-4），与 lunar.getMonth() 的符号语义一致
        if (lunar.getMonth() !== month || lunar.getDay() !== day) continue
        out.push({ year: y, month: m, day: d })
      }
    }
  }
  return out
}