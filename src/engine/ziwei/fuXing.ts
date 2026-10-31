import { DI_ZHI, type DiZhi, type TianGan } from '@/engine/calendar'

/**
 * 辅煞 / 杂曜安星（Y5-03）
 *
 * 口诀同样以 iztro「紫微斗数安星诀」为基准逐条编码，只落**结构**、不落吉凶评断：
 * - 辅弼昌曲（按生时支序号 t，子=0…亥=11）：
 *   左辅：辰宫顺数 → DIAG[4+t]；右弼：戌宫逆数 → DIAG[10−t]；
 *   文曲：辰宫顺（同左辅）；文昌：戌宫逆（同右弼）。
 * - 天魁 / 天钺（按生年干）：甲戊庚 丑/未；乙己 子/申；丙丁 亥/酉；辛 午/寅；壬癸 卯/巳。
 * - 禄存（生年干）＋擎羊（禄+1）/ 陀罗（禄−1）。
 * - 天马（生年支三合）：寅午戌→申；申子辰→寅；巳酉丑→亥；亥卯未→巳。
 * - 地劫（亥起，子时顺）、地空（亥起，子时逆）。
 *
 * ⚠️ 口径（待核校 Y5-09）：辅煞安宫是**排盘结构**、非命理解读；加流派差异大、
 * 黄金用例未入库，故**不宣称正确**，界面必须保持「待核校」可见。
 */

/** 地支 index：子0 丑1 寅2 卯3 辰4 巳5 午6 未7 申8 酉9 戍10 亥11 */
const I = (z: DiZhi): number => DI_ZHI.indexOf(z)

/** 生年干 → 禄存宫 index */
const LU_CUN: Record<TianGan, number> = {
  甲: I('寅'),
  乙: I('卯'),
  丙: I('巳'),
  丁: I('午'),
  戊: I('巳'),
  己: I('午'),
  庚: I('申'),
  辛: I('酉'),
  壬: I('亥'),
  癸: I('子')
}

/** 生年干 → [天魁宫, 天钺宫] */
const KUI_YUE: Record<TianGan, [number, number]> = {
  甲: [I('丑'), I('未')],
  乙: [I('子'), I('申')],
  丙: [I('亥'), I('酉')],
  丁: [I('亥'), I('酉')],
  戊: [I('丑'), I('未')],
  己: [I('子'), I('申')],
  庚: [I('丑'), I('未')],
  辛: [I('午'), I('寅')],
  壬: [I('卯'), I('巳')],
  癸: [I('卯'), I('巳')]
}

/** 生年支 → 天马宫（按三合局） */
const TIAN_MA: Record<DiZhi, DiZhi> = {
  申: '寅',
  子: '寅',
  辰: '寅',
  寅: '申',
  午: '申',
  戌: '申',
  巳: '亥',
  酉: '亥',
  丑: '亥',
  亥: '巳',
  卯: '巳',
  未: '巳'
}

export interface FuXingInput {
  yearGan: TianGan
  /** 生年支 */
  branch: DiZhi
  /** 生 0-23 */
  hour: number
  /** 农历生月（1-12）——左辅右弼按生月安（昌曲才按时辰） */
  lunarMonth: number
}

/** 地之节支序号（子=0…亥=11） */
function shiZhiIdx(hour: number): number {
  return Math.floor((hour + 1) / 2) % 12
}

/**
 * 辅煞落宫：返回 `地支 → 星名[]`。未覆盖的杂曜（红巅 / 孤辰 / 劫煞等）不在本批，
 * 由 Y5-03 后半补齐。
 */
export function arrangeFuXing(input: FuXingInput): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const b of DI_ZHI) out[b] = []

  const t = shiZhiIdx(input.hour)
  const m = input.lunarMonth - 1 // 农历月序号（1→0 … 12→11）
  const push = (z: number, name: string) => out[DI_ZHI[((z % 12) + 12) % 12]].push(name)

  // 左辅（辰月起、顺数月）/ 右弼（戌月起、逆数月）——iztro 2.6.1 同式
  push(I('辰') + m, '左辅')
  push(I('戌') - m, '右弼')
  // 文曲（辰时顺）/ 文昌（戌时逆）——iztro 同式
  push(I('辰') + t, '文曲')
  push(I('戌') - t, '文昌')

  // 魁钺（生年干）
  const [kui, yue] = KUI_YUE[input.yearGan]
  push(kui, '天魁')
  push(yue, '天钺')

  // 禄存 + 擎羊 / 陀罗
  const lu = LU_CUN[input.yearGan]
  push(lu, '禄存')
  push(lu + 1, '擎羊')
  push(lu - 1, '陀罗')

  // 天马（生年支）
  push(I(TIAN_MA[input.branch]), '天马')

  // 地劫（亥起，子时顺）/ 地空（亥起，子时逆）
  const hai = I('亥')
  push(hai + t, '地劫')
  push(hai - t, '地空')

  // 火星 / 铃星（生年支三合组基准 + 生时支顺数，iztro 2.6.1 同式，二源对拍见 ziwei-009）
  // 基准为「子时落地支」，「火星/铃星宫 = I(基准) + t」，与其余辅煞同处子=0 坐标。
  const HUO_BASE: Record<DiZhi, DiZhi> = {
    寅: '丑', 午: '丑', 戌: '丑',
    申: '寅', 子: '寅', 辰: '寅',
    巳: '卯', 酉: '卯', 丑: '卯',
    亥: '酉', 卯: '酉', 未: '酉'
  }
  const LING_BASE: Record<DiZhi, DiZhi> = {
    寅: '卯', 午: '卯', 戌: '卯',
    申: '戌', 子: '戌', 辰: '戌',
    巳: '戌', 酉: '戌', 丑: '戌',
    亥: '未', 卯: '未', 未: '未'
  }
  push(I(HUO_BASE[input.branch]) + t, '火星')
  push(I(LING_BASE[input.branch]) + t, '铃星')

  return out
}