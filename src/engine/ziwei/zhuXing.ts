import { DI_ZHI, GAN_YANG, type DiZhi, type TianGan } from '@/engine/calendar'
import type { MingGongResult } from './palace'

/**
 * 十四正曜安星 + 大限（Y5-02 / Y5-05）
 *
 * 安星口诀以 iztro「紫微斗数安星诀」（翻自《紫微斗数全书》）为基准，逐条编码如下：
 * - 起紫微星诀：六五四三二，酉午亥辰丑；局数除日数，商数宫前走；见数无余，起于虎口（寅）。
 * - 安天府星诀：天府南斗令，常对紫微宫（紫微 +6 → 对宫）。
 * - 安紫微诸星（逆排）：紫微 → 天机（-1）→ 隔一太阳（-3）→ 武曲（-4）→ 天同（-5）→ 廉贞（再隔二，-8）。
 * - 安天府诸星（顺排）：天府 → 太阴（+1）→ 贪狼（+2）→ 巨门（+3）→ 天相（+4）→ 天梁（+5）→
 *   七杀（+6）→ 空三 → 破军（+10）。
 * - 起大限诀：命宫起，阳男阴女顺行、阴男阳女逆行，每十年过一宫；起限岁数 = 五行局数。
 *
 * ⚠️ 口径（待核校 Y5-09）：安星是**排盘结构**、非命理解读，允许落地但必须标「待核校」；
 * golden（`golden/ziwei.json`，依赖 J3 流派拍板）未入库，故**不宣称正确**；
 * 生月 / 生时按公历推算（农历 / 节 / 闰）口径待核校，与 `palace.ts` 同。
 */

/**
 * 紫微星所在宫位（五行局数 2..6 × 农历出生日）
 *
 * 起紫微星诀：「六五四三二，酉午亥辰丑；局数除日数，商数宫前走；若见数无余，便要起虎口；日数小于局，还直宫中守。」
 *
 * ⚠️ 2026-09-22 修正（golden ziwei-001/002/004 抓到的**实现 defect**）：
 * 旧实现按「起点宫 + 商数」直推，4 例错 3 例；正确算法以**寅宫为 0** 起算：
 *   1. 日数逐次 +1（offset），直到能被局数整除；
 *   2. 商数 = (日数 + offset) / 局数，取 %12；
 *   3. 起始位 = 商数 − 1；
 *   4. offset 为偶数 → 顺行 offset 宫；奇数 → 逆行 offset 宫。
 * 依据：iztro 2.6.1 `getStartIndex()`（`star/location.ts`），并与 taibu-core@3.5.0 逐例一致（5/5）。
 */
export function ziWeiZhi(day: number, juNumber: number): DiZhi {
  const YIN = DI_ZHI.indexOf('寅') // 寅宫为 0
  let offset = 0
  let quotient = 0
  for (;;) {
    const d = day + offset
    if (d % juNumber === 0) {
      quotient = Math.floor(d / juNumber)
      break
    }
    offset += 1
  }
  quotient %= 12
  let idx = quotient - 1
  idx += offset % 2 === 0 ? offset : -offset
  idx = ((idx % 12) + 12) % 12
  return DI_ZHI[(YIN + idx) % 12]
}

/** 天府与紫微恒互为对宫（+6） */
export function tianFuZhi(ziWei: DiZhi): DiZhi {
  return DI_ZHI[(DI_ZHI.indexOf(ziWei) + 6) % 12]
}

/** 每宫主星（`branch` → 星名[]；空宫为空数组） */
export interface ZhuXingResult {
  /** 紫微所在地支 */
  ziWei: DiZhi
  /** 天府所在地支（对宫） */
  tianFu: DiZhi
  /** 每宫主星 */
  mainStars: Record<string, string[]>
}

/** 紫微系：相对紫微的逆盐数（紫微 0） */
const ZI_WEI_OFF: Record<string, number> = { 天机: -1, 太阳: -3, 武曲: -4, 天同: -5, 廉贞: -8 }

/** 天府系：相对天府（天府 0） */
const TIAN_FU_OFF: Record<string, number> = {
  太阴: 1,
  贪狼: 2,
  巨门: 3,
  天相: 4,
  天梁: 5,
  七杀: 6,
  破军: 10 // 七杀后空三宫 → 破军（天府 +10）
}

export function arrangeZhuXing(day: number, juNumber: number): ZhuXingResult {
  const ziWei = ziWeiZhi(day, juNumber)
  const tianFu = tianFuZhi(ziWei)

  const mainStars: Record<string, string[]> = {}
  for (const b of DI_ZHI) mainStars[b] = []

  const zw = DI_ZHI.indexOf(ziWei)
  const tf = DI_ZHI.indexOf(tianFu)
  mainStars[ziWei].push('紫微')
  mainStars[tianFu].push('天府')
  for (const [name, off] of Object.entries(ZI_WEI_OFF)) {
    mainStars[DI_ZHI[(zw + off + 12) % 12]].push(name)
  }
  for (const [name, off] of Object.entries(TIAN_FU_OFF)) {
    mainStars[DI_ZHI[(tf + off) % 12]].push(name)
  }

  return { ziWei, tianFu, mainStars }
}

export interface DaXianStep {
  index: number
  palace: DiZhi
  gongName: string
  startAge: number
  endAge: number
}

export interface DaXianResult {
  direction?: 'forward' | 'reverse'
  startAge: number
  steps: DaXianStep[]
  needsGender: boolean
}

/** 大限：命宫起；阳男 / 阴女顺行、阴男 / 阳女逆行；每十年过一宫；起限岁数 = 五行局数 */
export function computeDaXian(
  ming: MingGongResult,
  yearGan: TianGan,
  gender: 'male' | 'female' | undefined,
  startAge: number
): DaXianResult {
  const needsGender = !gender
  if (needsGender) return { startAge, steps: [], needsGender }

  const yearYang = GAN_YANG[yearGan]
  const forward = (gender === 'male' && yearYang) || (gender === 'female' && !yearYang)

  // 十二宫遍历次序：命宫 = [0]；顺 → [0..11]，逆 → [0, 11, 10, …, 1]
  const order = forward
    ? Array.from({ length: 12 }, (_, i) => i)
    : [0, ...Array.from({ length: 11 }, (_, i) => 11 - i)]

  const steps: DaXianStep[] = order.map((idx, k) => {
    const g = ming.twelveGong[idx]
    const a = startAge + k * 10
    return {
      index: k + 1,
      palace: g.branch,
      gongName: g.name,
      startAge: a,
      endAge: a + 9
    }
  })

  return { direction: forward ? 'forward' : 'reverse', startAge, steps, needsGender: false }
}

/** 依据地支把四化的星名映射到对应宫位（十四正曜可定位；辅煞四化星不在此列） */
export type SiHuaToPalaceKind = 'lu' | 'quan' | 'ke' | 'ji'

export interface SiHuaToPalace {
  kind: SiHuaToPalaceKind
  label: string
  star: string
  palace: DiZhi | null
}

export const SI_HUA_KIND_LABEL: Record<SiHuaToPalaceKind, string> = {
  lu: '禄',
  quan: '权',
  ke: '科',
  ji: '忌'
}

/** 把四化星名落到宫上：只对十四正曜中的星能定位；辅煞（文昌 / 文曲 / 辅弼等）返回 `palace: null`，留待安辅煞补全 */
export function siHuaByPalace(
  siHua: Record<'lu' | 'quan' | 'ke' | 'ji', string>,
  mainStars: Record<string, string[]>
): SiHuaToPalace[] {
  return (['lu', 'quan', 'ke', 'ji'] as const).map((kind) => {
    const star = siHua[kind]
    const palace =
      (DI_ZHI.find((b) => mainStars[b]?.includes(star)) as DiZhi | undefined) ?? null
    return { kind, label: SI_HUA_KIND_LABEL[kind], star, palace }
  })
}