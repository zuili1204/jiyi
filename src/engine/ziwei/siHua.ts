import type { TianGan } from '@/engine/calendar'

/**
 * 四化（Y5-04）：按**生年天干**定 化禄 / 化权 / 化科 / 化忌。
 *
 * ⚠️ **流派绑定**（JY-02 §6.4 第 6 步，YR3）：四化表各派不同，本表采用
 * **三合派**通行《全集》四化 —— **J3 已于 2026-09-22 拍板为三合派**（`JY-08 §2`），流派问题已解除。
 *
 * ✅ **`reviewed = true`（2026-09-23 转正）**：golden `ziwei-005/006` 已采且通过
 * （来源：《紫微斗数全集》四化表 / taibu-core@3.5.0 + iztro，两个非同源来源），详见下方常量注释。
 * 转正仅覆盖四化表本身，紫微整体仍 `reviewed:false`（闰月口径 / 小限待核）。
 */

export type SiHuaKind = 'lu' | 'quan' | 'ke' | 'ji'

export interface SiHuaResult {
  /** 年干 */
  yearGan: TianGan
  /** 化禄星 */
  lu: string
  /** 化权星 */
  quan: string
  /** 化科星 */
  ke: string
  /** 化忌星 */
  ji: string
}

/** 三合派四化表（年干 → 禄 / 权 / 科 / 忌） */
export const SI_HUA_TABLE: Record<TianGan, Omit<SiHuaResult, 'yearGan'>> = {
  甲: { lu: '廉贞', quan: '破军', ke: '武曲', ji: '太阳' },
  乙: { lu: '天机', quan: '天梁', ke: '紫微', ji: '太阴' },
  丙: { lu: '天同', quan: '天机', ke: '文昌', ji: '廉贞' },
  丁: { lu: '太阴', quan: '天同', ke: '天机', ji: '巨门' },
  戊: { lu: '贪狼', quan: '太阴', ke: '右弼', ji: '天机' },
  己: { lu: '武曲', quan: '贪狼', ke: '天梁', ji: '文曲' },
  庚: { lu: '太阳', quan: '武曲', ke: '太阴', ji: '天同' },
  辛: { lu: '巨门', quan: '太阳', ke: '文曲', ji: '文昌' },
  壬: { lu: '天梁', quan: '紫微', ke: '左辅', ji: '武曲' },
  癸: { lu: '破军', quan: '巨门', ke: '太阴', ji: '贪狼' }
}

/** 十四正曜（用于校验四化星名是否属于主星体系，便于结果标注） */
export const ZIWEI_MAIN_STARS = [
  '紫微',
  '天机',
  '太阳',
  '武曲',
  '天同',
  '廉贞',
  '天府',
  '太阴',
  '贪狼',
  '巨门',
  '天相',
  '天梁',
  '七杀',
  '破军'
]

/**
 * ✅ **已转正（2026-09-23，`false → true`）**，依据：
 * 1. **流派已定**：J3 已决议采用三合派（2026-09-22 拍板，见 `JY-08 §2`），本表即三合派通行《全集》四化；
 * 2. **golden 已采且通过**：`ziwei-005`（《紫微斗数全集》四化表，两典籍一致）、
 *    `ziwei-006`（taibu-core@3.5.0 mutagenSummary + iztro 逐星一致）—— **两个非同源来源**。
 *
 * 转正范围**仅限四化表本身**；紫微整体（`ziwei/index.ts` 的 `reviewed`）仍为 `false` ——
 * 闰月口径与小限公式尚无 golden 覆盖。
 */
export const SI_HUA_REVIEWED = true

export function computeSiHua(yearGan: TianGan): SiHuaResult {
  const row = SI_HUA_TABLE[yearGan]
  return { yearGan, ...row }
}
