import guanyinSet from './guanyin.json'
import guandiSet from './guandi.json'
import lvzuSet from './lvzu.json'
import type { LotsContentEntry, LotKind } from '@/engine/lots'

/**
 * 签占内容包（Y2-02 首三套）：观音 / 关帝 / 吕祖 灵签母版。
 *
 * ⚠️ 本目录是**产物**，由 `npm run content:sync` 从 `DOCS/content/lots/*.json` 单向生成，
 * **禁止手改**。人工编辑一律改母版（JY-01 §6）。
 *
 * 出处与许可随母版走（source / license / school / sourceNote），此处不再硬编码，
 * 保证「内容溯源」只有一处定义（JY-04 §3）。
 *
 * 纪律：此处是「内容数据」，引擎 interpret 只读取、不内联任何签文（JY-03 §2 纪律 2）。
 */

export type { LotKind }

export const LOT_KINDS: { kind: LotKind; label: string }[] = [
  { kind: 'guanyin', label: '观音灵签' },
  { kind: 'guandi', label: '关帝灵签' },
  { kind: 'lvzu', label: '吕祖灵签' }
]

interface RawLot {
  number: number
  level: string
  levelSource?: 'source' | 'inferred'
  poem: string[]
  interpretation: string
  story?: string
  category: string
}

interface LotSetDoc {
  source: string
  license: string
  school: string
  sourceNote?: string
  items: RawLot[]
}

const DOCS: Record<LotKind, LotSetDoc> = {
  guanyin: guanyinSet as unknown as LotSetDoc,
  guandi: guandiSet as unknown as LotSetDoc,
  lvzu: lvzuSet as unknown as LotSetDoc
}

/**
 * 统一吉凶等级轴（Y2-11 横向审校产出）
 *
 * 三套签的等级**口径不一致**：观音用 3 级（上签/中签/下签），关帝/吕祖用 6~7 级
 * （大吉/上上/上吉/中吉/中平/中下/下下）。直接按字符串比较或排序会串味，
 * 故统一映射到三档，供筛选 / 统计 / 分享图使用。
 *
 * 映射表（JY-01 §1 口径，改动须同步回改本表与审校记录）：
 *   吉 = 大吉 / 上上 / 上吉 / 上签
 *   中 = 中吉 / 中平 / 中签
 *   凶 = 中下 / 下下 / 下签
 */
export type LotGrade = 'ji' | 'zhong' | 'xiong'

const GRADE_MAP: Record<string, LotGrade> = {
  大吉: 'ji',
  上上: 'ji',
  上吉: 'ji',
  上签: 'ji',
  中吉: 'zhong',
  中平: 'zhong',
  中签: 'zhong',
  中下: 'xiong',
  下下: 'xiong',
  下签: 'xiong'
}

export const LOT_GRADE_LABEL: Record<LotGrade, string> = {
  ji: '吉',
  zhong: '中',
  xiong: '凶'
}

/** 原始等级文本 → 统一三档；未知等级返回 undefined（不猜） */
export function lotGrade(level?: string): LotGrade | undefined {
  if (!level) return undefined
  return GRADE_MAP[level.trim()]
}

/** 各套系的内容溯源（供结果页「出处」块与合规核验使用） */
export function getLotSource(kind: LotKind = 'guanyin') {
  const d = DOCS[kind]
  return { name: d.source, license: d.license, note: d.sourceNote ?? d.school }
}

function toEntry(r: RawLot, kind: LotKind): LotsContentEntry {
  const levelTag = r.level ? ` · ${r.level}${r.levelSource === 'inferred' ? '（推断）' : ''}` : ''
  return {
    index: r.number,
    title: `第 ${r.number} 签${levelTag}`,
    poem: r.poem.join('\n'),
    prose: r.interpretation,
    story: r.story || undefined,
    source: getLotSource(kind)
  }
}

const maps: Record<LotKind, Map<number, LotsContentEntry>> = {
  guanyin: new Map(DOCS.guanyin.items.map((r) => [r.number, toEntry(r, 'guanyin')])),
  guandi: new Map(DOCS.guandi.items.map((r) => [r.number, toEntry(r, 'guandi')])),
  lvzu: new Map(DOCS.lvzu.items.map((r) => [r.number, toEntry(r, 'lvzu')]))
}

/** 按套系 + 签号取签诗母版（供引擎 setLotsContentProvider 注入） */
export function getLotEntry(index: number, kind: LotKind = 'guanyin'): LotsContentEntry | undefined {
  return maps[kind]?.get(index)
}

/** 向后兼容：观音单套取签（测试复用） */
export function getGuanyinEntry(index: number): LotsContentEntry | undefined {
  return getLotEntry(index, 'guanyin')
}

export const guanyinLotsEntries = DOCS.guanyin.items.map((r) => toEntry(r, 'guanyin'))
