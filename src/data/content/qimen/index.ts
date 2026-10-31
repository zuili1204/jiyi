import dingJu from './dingJu.json'
import templates from './templates.json'
import type { Dun } from '@/engine/qimen/constants'

/**
 * 奇门内容包（Y6-01 定局表）
 *
 * ⚠️ 本目录是**产物**，由 `npm run content:sync` 从 `DOCS/content/qimen/dingJu.json` 单向生成，
 * **禁止手改**。人工编辑一律改母版（JY-01 §6）。
 *
 * 纪律：
 * - 局数表来自古籍口诀，**未过权威核校**（`reviewed = false`），结果页必须标注；
 * - 异文（大寒 / 春分 三九六 vs 三六九）登记在 `variants` 里，**不做静默选择**。
 */

export interface DingJuTerm {
  name: string
  dun: Dun
  shang: number
  zhong: number
  xia: number
}

export interface SanYuanRule {
  by: string
  shang: string[]
  zhong: string[]
  xia: string[]
  note: string
}

interface DingJuDoc {
  version: number
  source: string
  license: string
  school: string
  sourceNote?: string
  reviewed: boolean
  dingJuMethod: string
  sanYuanRule: SanYuanRule
  variants?: { terms: string[]; adopted: string; alternative: string; note: string }[]
  /** 内容闸要求母版统一用 `items`（结构校验口径） */
  items: DingJuTerm[]
}

const doc = dingJu as unknown as DingJuDoc

export const QIMEN_DINGJU_META = {
  version: doc.version,
  source: doc.source,
  license: doc.license,
  school: doc.school,
  sourceNote: doc.sourceNote,
  reviewed: doc.reviewed,
  dingJuMethod: doc.dingJuMethod
}

export const QIMEN_DINGJU_VARIANTS = doc.variants ?? []
export const QIMEN_SAN_YUAN_RULE: SanYuanRule = doc.sanYuanRule
export const dingJuTerms: DingJuTerm[] = doc.items

const termByName = new Map(doc.items.map((t) => [t.name, t]))

export function dingJuTerm(name: string): DingJuTerm | undefined {
  return termByName.get(name)
}

// ---------- 问事解读 / 择时择方模板母版（Y6-06） ----------

/**
 * 模板维度：
 * - `wenShi` 问事取用口径（按类别给「传统常看什么」的说明，不分类用户输入、不写断语）；
 * - `yongMen` 八门传统取用语义介绍；
 * - `fangWei` 九宫方位（后天八卦）；
 * - `zeShi` 择时口径；
 * - `overall` 整体说明。
 */
export type QimenTemplateDim = 'wenShi' | 'yongMen' | 'fangWei' | 'zeShi' | 'overall'

export interface QimenTemplateItem {
  id: string
  dim: QimenTemplateDim
  key: string
  label: string
  text: string
}

interface TemplateDoc {
  version: number
  source: string
  license: string
  school: string
  sourceNote?: string
  reviewed: boolean
  items: QimenTemplateItem[]
}

const tplDoc = templates as unknown as TemplateDoc

export const QIMEN_TPL_META = {
  version: tplDoc.version,
  source: tplDoc.source,
  license: tplDoc.license,
  school: tplDoc.school,
  sourceNote: tplDoc.sourceNote,
  reviewed: tplDoc.reviewed
}

const tplByKey = new Map<string, QimenTemplateItem>(tplDoc.items.map((t) => [`${t.dim}.${t.key}`, t]))
const tplOverall = tplDoc.items.find((t) => t.dim === 'overall')

export const qimenTemplateItems: QimenTemplateItem[] = tplDoc.items

/** 按 dim.key 取模板条目（缺源返回 undefined，不猜、不兜底编造） */
export function getQimenTemplate(dim: QimenTemplateDim, key: string): QimenTemplateItem | undefined {
  return tplByKey.get(`${dim}.${key}`)
}

export function getQimenTemplateOverall(): QimenTemplateItem | undefined {
  return tplOverall
}
