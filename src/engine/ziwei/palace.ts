import {
  DI_ZHI,
  TIAN_GAN,
  makeGanZhi,
  naYinWuXing,
  WU_XING_LABEL,
  type DiZhi,
  type GanZhi,
  type TianGan,
  type WuXing
} from '@/engine/calendar'

/**
 * 定命宫 + 五行局（Y5-01，JY-02 §6.4 第 1~2 步）
 *
 * 定命宫：自寅宫起正月，顺数至生月所在宫；再自该宫起子时，逆数至生时所在宫，即命宫。
 * 五行局：命宫干支 → 纳音五行 → 水二局 / 木三局 / 金四局 / 土五局 / 火六局。
 *
 * ⚠️ 口径（待核校 Y5-09，流派 J3 待拍板）：
 * - 生月 / 生时按**公历月 / 公历时**推算（未做农历 / 节气换算，闰月未特殊处理）；
 * - 命宫天干由「五虎遁」自年干推出（同子平月干遁法）；
 * - 仅定命宫与五行局，安星 / 四化 / 大限（Y5-02~05）未做，不冒充完整命盘。
 */

/** 十二宫序（自命宫逆排，JY-02 §6.4 第 7 步） */
export const ZIWEI_GONG_ORDER = [
  '命宫',
  '兄弟',
  '夫妻',
  '子女',
  '财帛',
  '疾厄',
  '迁移',
  '奴仆',
  '官禄',
  '田宅',
  '福德',
  '父母'
] as const
export type ZiweiGongName = (typeof ZIWEI_GONG_ORDER)[number]

/** 五虎遁：年干 → 寅宫（正月）天干 */
const WUHU_DUN: Record<TianGan, TianGan> = {
  甲: '丙',
  己: '丙',
  乙: '戊',
  庚: '戊',
  丙: '庚',
  辛: '庚',
  丁: '壬',
  壬: '壬',
  戊: '甲',
  癸: '甲'
}

/** 公历小时 → 时辰地支（子 23–1、丑 1–3 … 亥 21–23） */
function hourBranch(hour: number): DiZhi {
  return DI_ZHI[Math.floor((hour + 1) / 2) % 12]
}

export interface WuXingJu {
  element: WuXing
  /** 局数：水二 / 木三 / 金四 / 土五 / 火六 */
  number: number
  label: string
}

/** 局数中文（水二局 / 木三局 …） */
const JU_NUM_CN: Record<number, string> = { 2: '二', 3: '三', 4: '四', 5: '五', 6: '六' }

export interface MingGongResult {
  branch: DiZhi
  gan: TianGan
  ganZhi: string
  wuXingJu: WuXingJu
  /** 十二宫（自命宫逆排）：宫名 + 地支 */
  twelveGong: { name: ZiweiGongName; branch: DiZhi }[]
}

export function determineMingGong(
  yearGan: TianGan,
  month: number,
  hour: number
): MingGongResult {
  const yinIdx = DI_ZHI.indexOf('寅') // 2
  const monthBranch = DI_ZHI[(yinIdx + (month - 1)) % 12]
  const hb = hourBranch(hour)
  const mingIdx = (DI_ZHI.indexOf(monthBranch) - DI_ZHI.indexOf(hb) + 12) % 12
  const branch = DI_ZHI[mingIdx]

  // 命宫天干：五虎遁，从寅宫顺推至命宫支
  const baseGan = WUHU_DUN[yearGan]
  const offset = (mingIdx - yinIdx + 12) % 12
  const gan = TIAN_GAN[(TIAN_GAN.indexOf(baseGan) + offset) % 10]
  const gz: GanZhi = makeGanZhi(gan, branch)

  const element = naYinWuXing(gz)
  const number = { wood: 3, fire: 6, earth: 5, metal: 4, water: 2 }[element]
  const wuXingJu: WuXingJu = { element, number, label: `${WU_XING_LABEL[element]}${JU_NUM_CN[number]}局` }

  const twelveGong = ZIWEI_GONG_ORDER.map((name, i) => ({
    name,
    branch: DI_ZHI[(mingIdx - i + 12) % 12] as DiZhi
  }))

  return { branch, gan, ganZhi: gz.text, wuXingJu, twelveGong }
}
