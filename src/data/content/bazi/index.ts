import duanYu from './duanYu.json'
import type { ShiShen } from '@/engine/bazi'

/**
 * 八字内容包：参考性断语母版（Y4-10 + Y4-06 分项模板）
 *
 * ⚠️ 本目录是**产物**，由 `npm run content:sync` 把 `DOCS/content/bazi/*.json` 单向生成，
 * **禁止手改** JSON。人工编辑一律改母版（JY-01 §6）。
 *
 * 纪律：
 * - 断条为**本产品自撰**的中性参考（`school` 子平法），`reviewed:false` **待权威核校**，
 *   措辞已规避绝对化 / 凶灾 / 医疗 / 投资 / 性别等敏感表述（JY-04 §3），因此**不豁免**，
 *   仍走全词族严检。
 * - 由本文件的索引函数 `getBaziDuanEntries` 供给引擎 `setBaziDuanProvider`，供结果页出参考块。
 */

export interface BaziDuanEntry {
  id: string
  /** strength / shiShen / overall */
  dimension: string
  strength: string
  shiShen: string
  title: string
  text: string
}

interface DuanDoc {
  version: number
  source: string
  license: string
  school: string
  sourceNote?: string
  reviewed: boolean
  items: BaziDuanEntry[]
}

const doc = duanYu as unknown as DuanDoc

export const BAZI_DUAN_META = {
  version: doc.version,
  source: doc.source,
  license: doc.license,
  school: doc.school,
  sourceNote: doc.sourceNote,
  reviewed: doc.reviewed
}

/** 按 dimension → key → 条目 索引（供引擎快速取用） */
const strengthIndex = new Map<string, BaziDuanEntry>(
  doc.items.filter((i) => i.dimension === 'strength').map((i) => [i.strength, i])
)
const shiShenIndex = new Map<string, BaziDuanEntry>(
  doc.items
    .filter((i) => i.dimension === 'shiShen')
    .map((i) => [i.shiShen, i])
)
const overall = doc.items.find((i) => i.dimension === 'overall')

export const baziDuanItems: BaziDuanEntry[] = doc.items

/**
 * 输入参数：日主强弱 + 月干十神。
 * 强/弱 用布尔表达（与 StrengthDetail.level → weak/moderate 映射由引擎层完成）。
 */
export interface BaziDuanInput {
  /** weak=true 取「偏弱」；否则再按 moderate 档；都不表示偏强 */
  weak?: boolean
  moderate?: boolean
  shiShen?: ShiShen
}

/**
 * 按「日主强弱 + 月干十神」取 参考断条集。
 * 返回 强弱条 / 十神条 / 整体条 三段的顺序排列；缺失时降级（不猜）。
 */
export function getBaziDuanEntries(o: BaziDuanInput): BaziDuanEntry[] {
  const out: BaziDuanEntry[] = []
  const sKey = o.weak ? 'weak' : o.moderate ? 'moderate' : 'strong'
  const se = strengthIndex.get(sKey)
  if (se) out.push(se)
  if (o.shiShen) {
    const sh = shiShenIndex.get(o.shiShen)
    if (sh) out.push(sh)
  }
  if (overall) out.push(overall)
  return out
}