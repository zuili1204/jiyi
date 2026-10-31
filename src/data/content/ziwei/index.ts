import palaceStars from './palaceStars.json'
import type { ZiweiGongName } from '@/engine/ziwei'

/**
 * 紫微内容包：星宫组合母版（Y5-07）
 *
 * ⚠️ 本目录是**产物**，由 `npm run content:sync` 把 `DOCS/content/ziwei/*.json` 单向生成，
 * **禁止手改** JSON。人工编辑一律改母版（JY-01 §6）。
 *
 * 纪律（对标八字 `bazi/duanYu.json`）：
 * - 条目为本产品自撰的**中性参考**（`school` 三合派），`reviewed:false` **待权威核校**，
 *   措辞已规避绝对化 / 医疗 / 投资 / 性别 / 灾祸等敏感表述（JY-04 §3），因此**不豁免**，
 *   仍走全词族严检。
 * - 本文件索引 `getPalaceStarEntries` / `getPalaceDualEntries` 供给
 *   引擎 `setZiweiPalaceProvider`，供结果页在星宫结构之后出参考块（类似 iching 义理导读）。
 */

export interface ZiweiPalaceEntry {
  id: string
  /** single（单星）/ dual（双星同宫） */
  kind: 'single' | 'dual'
  /** 单星条目：落下/单颗主曜；双星条目：同宫的两颗主曜（如「紫微天府」） */
  star: string
  gong: ZiweiGongName
  text: string
}

/** 半结构化 JSON 条目（母版只保证 id / kind / star / gong / text） */
interface PalaceStarItem {
  id: string
  kind?: string
  star?: string
  stars?: string
  gong?: string
  text?: string
}

interface PalaceStarsDoc {
  version: number
  source: string
  license: string
  school: string
  sourceNote?: string
  reviewed: boolean
  items: unknown[]
}

const doc = palaceStars as unknown as PalaceStarsDoc

const items: ZiweiPalaceEntry[] = (doc.items as unknown as PalaceStarItem[]).map((it) => ({
  id: it.id,
  kind: it.kind === 'dual' ? 'dual' : 'single',
  // 母版 single 用 `star`、dual 用 `stars`（整串双星名），统一到 `star`
  star: it.star || it.stars || '',
  gong: (it.gong || '命宫') as ZiweiGongName,
  text: it.text || ''
}))

export const ZIWEI_PALACE_META = {
  version: doc.version,
  source: doc.source,
  license: doc.license,
  school: doc.school,
  sourceNote: doc.sourceNote,
  reviewed: doc.reviewed
}

const singleIndex = new Map<string, ZiweiPalaceEntry>()
for (const it of items) {
  if (it.kind === 'single') singleIndex.set(`${it.star}/${it.gong}`, it)
}
const dualIndex = new Map<string, ZiweiPalaceEntry>()
for (const it of items) {
  if (it.kind === 'dual') dualIndex.set(`${it.star}/${it.gong}`, it)
}

/** 单星条目：某主星落某宫 */
export function getPalaceStarEntry(
  star: string,
  gong: ZiweiGongName
): ZiweiPalaceEntry | undefined {
  return singleIndex.get(`${star}/${gong}`)
}

/** 双星条目：某两主星同宫（stars 传整串，如「紫微天府」） */
export function getPalaceDualEntry(
  stars: string,
  gong: ZiweiGongName
): ZiweiPalaceEntry | undefined {
  return dualIndex.get(`${stars}/${gong}`)
}

export const ziweiPalaceItems: ZiweiPalaceEntry[] = items
export { items }