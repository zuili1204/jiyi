import hexagrams from './hexagrams.json'
import lines from './lines.json'
import templates from './templates.json'
import type { IchingTextEntry } from '@/engine/iching'

/**
 * 卜筮内容包：六十四卦母版（Y3-01）
 *
 * ⚠️ 本目录是**产物**，由 `npm run content:sync` 从 `DOCS/content/iching/hexagrams.json` 单向生成，
 * **禁止手改**。人工编辑一律改母版（JY-01 §6）。
 *
 * 纪律：
 * - 卦辞（ci）/ 大象（daXiang）为**古籍原文**，白话（baiHua）为**本产品自撰**；
 *   内容闸对前者豁免、对后者严检（JY-01 §7 纪律 2）。
 * - `reviewed = false` 期间**不得宣称内容权威**，结果页须标注「卦爻辞待核验」。
 */

export interface HexagramTextItem {
  index: number
  name: string
  upper: string
  lower: string
  gong: string
  gongWuXing: string
  ci?: string
  daXiang?: string
  baiHua?: string
}

interface HexagramDoc {
  version: number
  source: string
  license: string
  school: string
  sourceNote?: string
  reviewed: boolean
  items: HexagramTextItem[]
}

const doc = hexagrams as unknown as HexagramDoc

export const HEXAGRAM_TEXT_META = {
  version: doc.version,
  source: doc.source,
  license: doc.license,
  school: doc.school,
  sourceNote: doc.sourceNote,
  reviewed: doc.reviewed
}

const byIndex = new Map<number, HexagramTextItem>(doc.items.map((it) => [it.index, it]))

/** 爻辞（Y3-02）单条 */
export interface LineTextItem {
  index: number
  name: string
  /** 1–6，自下而上 */
  position: number
  yaoTitle: string
  yang: boolean
  /** 爻辞原文 */
  ci: string
  /** 小象（象传，原文） */
  xiaoXiang?: string
  /** 白话（自撰）；尚未撰写时为空 */
  baiHua?: string
  /** 源数据缺陷：爻题与卦象不符 */
  conflict?: boolean
  /** 源数据缺陷：与其他爻辞完全重复，疑似抄串 */
  dupSuspected?: boolean
}

interface LineDoc {
  items: LineTextItem[]
  yong?: { index: number; name: string; yaoTitle: string; ci: string }[]
}
const lineDoc = lines as unknown as LineDoc
const yaoByIndex = new Map<number, string[]>(
  Array.from({ length: 64 }, (_, i) => {
    const hex = i + 1
    const six = lineDoc.items
      .filter((l) => l.index === hex)
      .sort((a, b) => a.position - b.position)
      .map((l) => (l.yaoTitle ? `${l.yaoTitle}：${l.ci}` : l.ci))
    return [hex, six] as [number, string[]]
  })
)

/** 按文王卦序取卦文本（含爻辞，供引擎 setIchingTextProvider 注入） */
export function getHexagramText(index: number): IchingTextEntry | undefined {
  const it = byIndex.get(index)
  if (!it) return undefined
  return {
    index: it.index,
    name: it.name,
    ci: it.ci,
    daXiang: it.daXiang,
    yaoCi: yaoByIndex.get(index),
    reviewed: doc.reviewed,
    source: { name: doc.source, license: doc.license, note: doc.school }
  }
}

export const hexagramTextItems: HexagramTextItem[] = doc.items

/** 爻辞条目（384 条，供测试与审校统计） */
export const lineTextItems: LineTextItem[] = lineDoc.items

/** 用九 / 用六 附加条目（不属于 384 爻） */
export const yongItems: NonNullable<LineDoc['yong']> = lineDoc.yong ?? []

/** 乾「用九」/ 坤「用六」等附加爻辞 */
export function getYongText(index: number) {
  return (lineDoc.yong ?? []).find((y) => y.index === index)
}

// ---------- 断语模板母版（Y3-09） ----------

/** 模板条目：统一 dim（meihua / yongShen / overall）+ key，引擎按需取 */
export interface IchingTemplateItem {
  id: string
  dim: 'meihua' | 'yongShen' | 'overall'
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
  items: IchingTemplateItem[]
}

const tplDoc = templates as unknown as TemplateDoc

export const ICHING_TPL_META = {
  version: tplDoc.version,
  source: tplDoc.source,
  license: tplDoc.license,
  school: tplDoc.school,
  sourceNote: tplDoc.sourceNote,
  reviewed: tplDoc.reviewed
}

const tplByKey = new Map<string, IchingTemplateItem>(tplDoc.items.map((t) => [`${t.dim}.${t.key}`, t]))
const tplOverall = tplDoc.items.find((t) => t.dim === 'overall')

export const ichingTemplateItems: IchingTemplateItem[] = tplDoc.items

/** 按 dim.key 取断句条目（缺源降级 undefined，不猜） */
export function getIchingTemplate(dim: 'meihua' | 'yongShen', key: string): IchingTemplateItem | undefined {
  return tplByKey.get(`${dim}.${key}`)
}

export function getIchingTemplateOverall(): IchingTemplateItem | undefined {
  return tplOverall
}

// ---------- 义理解卦导航（Y3-04） ----------

/** 由规范性生产的自撰 baiHua 作义理解卦导读（不新增 64 句，复用已验证白话） */
export function getYiLiEntries(guaIndexes: {
  ben: number
  bian?: number
  hu?: number
}): { guaContents: { index: number; name: string; baiHua?: string }[] } | undefined {
  const items: { index: number; name: string; baiHua?: string }[] = []
  const add = (i?: number) => {
    const it = byIndex.get(i ?? -1)
    if (it) items.push({ index: it.index, name: it.name, baiHua: it.baiHua })
  }
  add(guaIndexes.ben)
  add(guaIndexes.bian)
  add(guaIndexes.hu)
  return items.length ? { guaContents: items } : undefined
}
