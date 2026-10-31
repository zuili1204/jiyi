import { DI_ZHI, type DiZhi, type TianGan } from '@/engine/calendar'

/**
 * 杂曜安星（Y5-03 后半，以生年支 / 生月支 / 生时支为主）
 *
 * 口诀基准：iztro「紫微斗数安星诀」逐条对照编码（docs.iztro.com/learn/setup），只落
 * **结构**、不落吉凶。星曜几乎按「起宫 + 顺/逆」线性围展，无流派差异。
 *
 * ✅ **杂曜已转正（2026-09-24，`reviewed` 由 false → true）**：以 iztro@2.6.1 为第二源
 * （联网安装采样）逐项核对通过 —— 天官 / 天福 / 三台 / 八座 / 恩光 / 天贵 / 蜚廉 / 解神
 * 落宫全部一致（golden `ziwei-013`）。**蜚廉**此前因表义歧义刻意未落地，现已按实测定表补上。
 *
 * ⚠️ 转正**不含**：① **月解**（iztro 体系用「年解」，无对应字段可核）；② 其余未列杂曜
 * （天才 / 天寿 / 台辅 / 封诰 等本次未逐项对拍）。月解仍按农历月推出，标注待核。
 */

/** 地支 index：子0 丑1 寅2 卯3 辰4 巳5 午6 未7 申8 酉9 戍10 亥11 */
const I = (z: DiZhi): number => DI_ZHI.indexOf(z)
/** 取模进盘（可负 / 可越界） */
const M = (n: number): number => ((n % 12) + 12) % 12

/** 华盖：三合局墓库 */
const HUA_GAI: Record<DiZhi, DiZhi> = {
  子: '辰', 丑: '丑', 寅: '戌', 卯: '未',
  辰: '辰', 巳: '丑', 午: '戌', 未: '未',
  申: '辰', 酉: '丑', 戌: '戌', 亥: '未'
}

/** 咸池：三合局旺位对冲 */
const XIAN_CI: Record<DiZhi, DiZhi> = {
  子: '酉', 丑: '午', 寅: '卯', 卯: '子',
  辰: '酉', 巳: '午', 午: '卯', 未: '子',
  申: '酉', 酉: '午', 戌: '卯', 亥: '子'
}

/** 破碎：四正季支定宫 */
const PO_SUI: Record<DiZhi, DiZhi> = {
  子: '巳', 午: '巳', 卯: '巳', 酉: '巳',
  寅: '酉', 申: '酉', 巳: '酉', 亥: '酉',
  辰: '卯', 戌: '卯', 丑: '卯', 未: '卯'
}

/** 孤辰（生年支三合局），寡宿宫 = 孤辰 − 4 */
const GU_GU: Record<DiZhi, DiZhi> = {
  寅: '巳', 卯: '巳', 辰: '巳',
  巳: '申', 午: '申', 未: '申',
  申: '亥', 酉: '亥', 戌: '亥',
  亥: '寅', 子: '寅', 丑: '寅'
}

export interface ZaYaoInput {
  yearGan: TianGan
  /** 生年支 */
  branch: DiZhi
  /** 生月支 */
  monthBranch: DiZhi
  /** 生 0-23 */
  hour: number
  /** 农历日（1-30，用于三台 / 八座 / 恩光 / 天贵） */
  lunarDay?: number
  /** 农历月（1-12，用于解神 / 月解） */
  lunarMonth?: number
  /** 左辅落宫（三台起宫） */
  zuoFu?: DiZhi
  /** 右弼落宫（八座起宫） */
  youBi?: DiZhi
  /** 文昌落宫（恩光起宫） */
  wenChang?: DiZhi
  /** 文曲落宫（天贵起宫） */
  wenQu?: DiZhi
}

/** 时辰支序号（子=0…亥=11） */
function shiZhiIdx(hour: number): number {
  return Math.floor((hour + 1) / 2) % 12
}

/**
 * 杂曜落宫：返回 `地支 → 星名[]`。
 */
export function arrangeZaYao(input: ZaYaoInput): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const b of DI_ZHI) out[b] = []

  const b = I(input.branch) // 生年支序号
  const mo = I(input.monthBranch) // 生月支序号
  const x = shiZhiIdx(input.hour) // 生时支序号

  const push = (z: number, name: string) => out[DI_ZHI[M(z)]].push(name)

  // 红鸾（卯起子逆数）/ 天喜（对宫）
  const lu = M(3 - b)
  push(lu, '红鸾')
  push(lu + 6, '天喜')

  // 龙池（辰起子顺）/ 凤阁（戌起子逆）
  push(M(4 + b), '龙池')
  push(M(10 - b), '凤阁')

  // 华盖 / 咸池 / 破碎
  push(I(HUA_GAI[input.branch]), '华盖')
  push(I(XIAN_CI[input.branch]), '咸池')
  push(I(PO_SUI[input.branch]), '破碎')

  // 孤辰（寡宿 = 孤 − 4 宫）
  const gu = I(GU_GU[input.branch])
  push(gu, '孤辰')
  push(gu - 4, '寡宿')

  // 天哭（午起子逆）/ 天虚（午起子顺）
  push(6 - b, '天哭')
  push(6 + b, '天虚')

  // 天刑（酉起正月顺）/ 天姚（丑起正月顺）
  push(10 + mo, '天刑')
  push(1 + mo, '天姚')

  // 台辅（午起子时顺）/ 封诰（寅起子时逆）
  push(5 + x, '台辅')
  push(2 - x, '封诰')

  /* ---- 补齐杂曜（iztro `紫微斗数安星诀` 逐条，Y5-09 待核校、reviewed=false） ---- */

  // 日系：三台 / 八座 / 恩光 / 天贵
  // ⚠️ 2026-09-24 修正：原公式误用「生时支 x」（写成 左辅=4+x、右弼=10−x），
  //    与 iztro 实测不符。正确规则（以 iztro@2.6.1 三例实测确认）：
  //      三台 = 左辅 + (日−1)　八座 = 右弼 − (日−1)
  //      恩光 = 文昌 + (日−1) − 1　天贵 = 文曲 + (日−1) − 1
  //    故必须先拿到左辅/右弼/文昌/文曲的宫位（由 `arrangeFuXing` 排出后传入）。
  const dayIdx = (input.lunarDay ?? 1) - 1
  if (input.zuoFu && input.youBi && input.wenChang && input.wenQu) {
    push(I(input.zuoFu) + dayIdx, '三台')
    push(I(input.youBi) - dayIdx, '八座')
    push(I(input.wenChang) + dayIdx - 1, '恩光')
    push(I(input.wenQu) + dayIdx - 1, '天贵')
  }
  // 缺左辅/右弼/昌曲宫位时**不编造**（纪律：宁缺勿滥）

  // 天官 / 天福（生年干表，转录自 iztro getYearlyStarIndex，逐字核校）
  const TIAN_GUAN_GAN: Record<TianGan, DiZhi> = {
    甲: '未', 乙: '辰', 丙: '巳', 丁: '寅', 戊: '卯',
    己: '酉', 庚: '亥', 辛: '酉', 壬: '戌', 癸: '午'
  }
  const TIAN_FU_GAN: Record<TianGan, DiZhi> = {
    甲: '酉', 乙: '申', 丙: '子', 丁: '亥', 戊: '卯',
    己: '寅', 庚: '午', 辛: '巳', 壬: '午', 癸: '巳'
  }
  push(I(TIAN_GUAN_GAN[input.yearGan]), '天官')
  push(I(TIAN_FU_GAN[input.yearGan]), '天福')

  // 蜚廉（生年支）—— 表曾因转录键值歧义而**故意不落地**（纪律：不编造）；
  // 2026-09-24 以 iztro@2.6.1 实测十二例（1984-1995 依次取子..亥）定表：
  // 子申、丑酉、寅戌、卯巳、辰午、巳未、午寅、未卯、申辰、酉亥、戌子、亥丑
  const FEI_LIAN_ZHI: Record<DiZhi, DiZhi> = {
    子: '申', 丑: '酉', 寅: '戌', 卯: '巳', 辰: '午', 巳: '未',
    午: '寅', 未: '卯', 申: '辰', 酉: '亥', 戌: '子', 亥: '丑'
  }
  push(I(FEI_LIAN_ZHI[input.branch]), '蜚廉')

  // 解神 / 月解（生农历月：正二申、三四戌、五六子、七八寅、九十辰、十一二午）
  if (input.lunarMonth) {
    const YUE_JIE: DiZhi[] = ['申', '戌', '子', '寅', '辰', '午']
    push(I(YUE_JIE[Math.floor((input.lunarMonth - 1) / 2)]), '解神')
  }

  return out
}