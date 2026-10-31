import {
  fourPillars,
  GAN_YANG,
  ganZhiFromIndex,
  jieQiTime,
  JIE_12,
  type DateTimeInput
} from '@/engine/calendar'
import type { BaziInput, BaziPillarsResult } from './pillars'
import { shiShenOf, type ShiShen } from './shiShen'

/**
 * 大运起运 + 流年（Y4-03，JY-02 §6.1 第 7/8 步）
 *
 * 大运顺逆：阳男阴女**顺行**、阴男阳女**逆行**（年干阴阳 × 性别）。
 * 起运：出生时刻距最近一个「节」的时间，**三天折一岁、一天折四月、一个时辰折十天**。
 *
 * ⚠️ 口径（待核校 Y4-09）：
 * - 取「节」按十二节（立春 / 惊蛰 / …），顺取下一个节、逆取上一个节；
 * - 起运折算：3 天 = 1 岁，1 天 = 4 月，1 时辰(2 小时) = 10 运日，**按分钟整数折算**
 *   （1 岁 = 4320 分 = 3 天，1 月 = 360 分，1 运日 = 12 分 = 1 时辰/10），首步大运精确到月起运；
 *   ⚠️ 折算规则是通行做法，权威 golden 未入库（Y4-09），不宣称正确；
 * - 流年按**当前公历年的年柱**（以立春分界），相对日主取十神。
 * 未提供性别时无法定顺逆，结果只给流年并标注「需性别」。
 */
export interface DaYunStep {
  /** 第几步（1 起） */
  index: number
  ganZhi: string
  /** 起始年龄（整岁；首步的精确月 / 日见 startMonths / startDays） */
  startAge: number
  /** 结束年龄（起始 + 9；首步按精确起运日顺延） */
  endAge: number
  /** 首步大运的精确起运月（0..11，后续每步整十年、无此字段） */
  startMonths?: number
  /** 首步大运的精确起运日（运日 0..29，仅作展示精度） */
  startDays?: number
}

export interface DaYunResult {
  /** 顺行 / 逆行 */
  direction?: 'forward' | 'reverse'
  /** 起运岁数 */
  qiYun?: { years: number; months: number; days: number }
  /** 大运序列（8 步） */
  steps: DaYunStep[]
  /** 当前流年（按当前公历年）：干支 + 十神 */
  liuNian?: { year: string; shiShen: ShiShen }
  /** 未提供性别时，无法定顺逆 */
  needsGender: boolean
}

/** 取最近一个「节」：顺向取下一个、逆向取上一个 */
function nearestJie(birth: Date, forward: boolean): Date | undefined {
  const y = birth.getFullYear()
  const candidates: number[] = []
  for (const yr of [y - 2, y - 1, y, y + 1, y + 2]) {
    for (const name of JIE_12) {
      const t = jieQiTime(yr, name)
      if (t) candidates.push(t.getTime())
    }
  }
  const uniq = [...new Set(candidates)].sort((a, b) => a - b)
  if (forward) return uniq.length ? new Date(uniq.find((ms) => ms > birth.getTime())!) : undefined
  const prev = uniq.filter((ms) => ms < birth.getTime())
  return prev.length ? new Date(prev[prev.length - 1]) : undefined
}

function toDate(d: DateTimeInput): Date {
  return new Date(d.year, d.month - 1, d.day, d.hour, d.minute)
}

export function computeDaYun(input: BaziInput, r: BaziPillarsResult): DaYunResult {
  const dm = r.pillars.day.gan
  const gender = input.gender
  const needsGender = !gender
  const forward = gender ? GAN_YANG[r.pillars.year.gan] === (gender === 'male') : undefined

  // 流年：当前公历年的年柱（以立春分界），相对日主取十神
  const now = new Date()
  const lnGz = fourPillars({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes()
  }).year
  const liuNian = { year: lnGz.text, shiShen: shiShenOf(dm, lnGz.gan) }

  if (forward === undefined) {
    return { steps: [], liuNian, needsGender }
  }

  const birth = toDate(r.usedAt)
  const jie = nearestJie(birth, forward)
  if (!jie) {
    return { direction: forward ? 'forward' : 'reverse', steps: [], liuNian, needsGender }
  }

  // 精确起运：把「出生时刻到最近一个节」的时长按下列折算，**用整数分钟运算**，避免浮点漂移：
  //   3 天 = 1 岁｜1 天 = 4 月｜1 时辰(2 小时) = 10 运日
  // 统一到分钟：1 岁 = 3×24×60 = 4320 分；1 月 = 42480/12 = 360 分；1 运日 = 1 时辰/10 = 12 分。
  // 仍注「待核校（Y4-09）」：折算规则是通行做法，但合法权威的 golden 用例尚未入库，
  // 故不宣称正确。
  const diff = Math.round(Math.abs(jie.getTime() - birth.getTime()) / 60_000)
  const years = Math.floor(diff / 4320)
  const months = Math.floor((diff % 4320) / 360)
  const days = Math.floor((diff % 360) / 12) // 0..29 运日
  const qiYun = { years, months, days }

  const monthIndex = r.pillars.month.index
  const steps: DaYunStep[] = []
  for (let k = 1; k <= 8; k += 1) {
    const idx = monthIndex + k * (forward ? 1 : -1)
    const gz = ganZhiFromIndex(idx)
    const startAge = years + (k - 1) * 10
    const step: DaYunStep = { index: k, ganZhi: gz.text, startAge, endAge: startAge + 9 }
    // 首步从「X 岁 X 月 X 日」精确起运，后续每步才整十年一格
    if (k === 1 && (months > 0 || days > 0)) {
      step.startMonths = months
      step.startDays = days
    }
    steps.push(step)
  }

  return {
    direction: forward ? 'forward' : 'reverse',
    qiYun,
    steps,
    liuNian,
    needsGender
  }
}
