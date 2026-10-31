/**
 * 易卦常量层（Y3 前置 / JY-02 §6）
 *
 * 纪律：
 * - 爻序一律**自下而上**（初爻 → 上爻），全模块统一，禁止在别处各写一份；
 * - 先天八卦数：乾1 兑2 离3 震4 巽5 坎6 艮7 坤8（梅花起卦用）；
 * - 卦名 / 卦序取自**文王卦序**（朱熹《周易本义》卦序歌），与 JY-01 §7「通行本（王弼注系统 / 文王卦序）」一致；
 * - 本表只含**结构**（卦名 / 上下卦 / 序号 / 五行），**不含卦辞爻辞**——那是内容母版的事（Y3-01/02）。
 */

export type TrigramName = '乾' | '兑' | '离' | '震' | '巽' | '坎' | '艮' | '坤'
export type WuXing = '金' | '木' | '水' | '火' | '土'
/** 爻：true = 阳（—），false = 阴（--）；下标 0 为初爻 */
export type Line = boolean

export interface Trigram {
  name: TrigramName
  /** 符号（☰☱☲☳☴☵☶☷） */
  symbol: string
  /** 自下而上三爻 */
  lines: [Line, Line, Line]
  /** 先天八卦数 1–8 */
  number: number
  element: WuXing
}

export const TRIGRAMS: Trigram[] = [
  { name: '乾', symbol: '☰', lines: [true, true, true], number: 1, element: '金' },
  { name: '兑', symbol: '☱', lines: [true, true, false], number: 2, element: '金' },
  { name: '离', symbol: '☲', lines: [true, false, true], number: 3, element: '火' },
  { name: '震', symbol: '☳', lines: [true, false, false], number: 4, element: '木' },
  { name: '巽', symbol: '☴', lines: [false, true, true], number: 5, element: '木' },
  { name: '坎', symbol: '☵', lines: [false, true, false], number: 6, element: '水' },
  { name: '艮', symbol: '☶', lines: [false, false, true], number: 7, element: '土' },
  { name: '坤', symbol: '☷', lines: [false, false, false], number: 8, element: '土' }
]

export const TRIGRAM_BY_NAME: Record<TrigramName, Trigram> = TRIGRAMS.reduce(
  (acc, t) => {
    acc[t.name] = t
    return acc
  },
  {} as Record<TrigramName, Trigram>
)

/** 先天数 → 卦（梅花起卦用；1–8 之外即非法） */
export function trigramByNumber(n: number): Trigram {
  const t = TRIGRAMS.find((x) => x.number === n)
  if (!t) throw new Error(`先天八卦数必须是 1–8，收到 ${n}`)
  return t
}

/** 三爻 → 卦（自下而上） */
export function trigramByLines(lines: readonly Line[]): Trigram {
  const t = TRIGRAMS.find(
    (x) => x.lines[0] === lines[0] && x.lines[1] === lines[1] && x.lines[2] === lines[2]
  )
  if (!t) throw new Error(`无法由爻象确定八卦：${lines.join(',')}`)
  return t
}

export interface Hexagram {
  /** 文王卦序 1–64 */
  index: number
  name: string
  upper: TrigramName
  lower: TrigramName
}

/** [序号, 卦名, 上卦, 下卦] —— 文王卦序 64 卦 */
const HEXAGRAM_ROWS: [number, string, TrigramName, TrigramName][] = [
  [1, '乾', '乾', '乾'],
  [2, '坤', '坤', '坤'],
  [3, '屯', '坎', '震'],
  [4, '蒙', '艮', '坎'],
  [5, '需', '坎', '乾'],
  [6, '讼', '乾', '坎'],
  [7, '师', '坤', '坎'],
  [8, '比', '坎', '坤'],
  [9, '小畜', '巽', '乾'],
  [10, '履', '乾', '兑'],
  [11, '泰', '坤', '乾'],
  [12, '否', '乾', '坤'],
  [13, '同人', '乾', '离'],
  [14, '大有', '离', '乾'],
  [15, '谦', '坤', '艮'],
  [16, '豫', '震', '坤'],
  [17, '随', '兑', '震'],
  [18, '蛊', '艮', '巽'],
  [19, '临', '坤', '兑'],
  [20, '观', '巽', '坤'],
  [21, '噬嗑', '离', '震'],
  [22, '贲', '艮', '离'],
  [23, '剥', '艮', '坤'],
  [24, '复', '坤', '震'],
  [25, '无妄', '乾', '震'],
  [26, '大畜', '艮', '乾'],
  [27, '颐', '艮', '震'],
  [28, '大过', '兑', '巽'],
  [29, '坎', '坎', '坎'],
  [30, '离', '离', '离'],
  [31, '咸', '兑', '艮'],
  [32, '恒', '震', '巽'],
  [33, '遁', '乾', '艮'],
  [34, '大壮', '震', '乾'],
  [35, '晋', '离', '坤'],
  [36, '明夷', '坤', '离'],
  [37, '家人', '巽', '离'],
  [38, '睽', '离', '兑'],
  [39, '蹇', '坎', '艮'],
  [40, '解', '震', '坎'],
  [41, '损', '艮', '兑'],
  [42, '益', '巽', '震'],
  [43, '夬', '兑', '乾'],
  [44, '姤', '乾', '巽'],
  [45, '萃', '兑', '坤'],
  [46, '升', '坤', '巽'],
  [47, '困', '兑', '坎'],
  [48, '井', '坎', '巽'],
  [49, '革', '兑', '离'],
  [50, '鼎', '离', '巽'],
  [51, '震', '震', '震'],
  [52, '艮', '艮', '艮'],
  [53, '渐', '巽', '艮'],
  [54, '归妹', '震', '兑'],
  [55, '丰', '震', '离'],
  [56, '旅', '离', '艮'],
  [57, '巽', '巽', '巽'],
  [58, '兑', '兑', '兑'],
  [59, '涣', '巽', '坎'],
  [60, '节', '坎', '兑'],
  [61, '中孚', '巽', '兑'],
  [62, '小过', '震', '艮'],
  [63, '既济', '坎', '离'],
  [64, '未济', '离', '坎']
]

export const HEXAGRAMS: Hexagram[] = HEXAGRAM_ROWS.map(([index, name, upper, lower]) => ({
  index,
  name,
  upper,
  lower
}))

const KEY = (upper: TrigramName, lower: TrigramName) => `${upper}/${lower}`

const HEX_BY_TRIGRAMS = new Map<string, Hexagram>(HEXAGRAMS.map((h) => [KEY(h.upper, h.lower), h]))

/** 上下卦 → 六十四卦（查不到即数据缺失，抛错而不是返回 undefined） */
export function hexagramByTrigrams(upper: TrigramName, lower: TrigramName): Hexagram {
  const h = HEX_BY_TRIGRAMS.get(KEY(upper, lower))
  if (!h) throw new Error(`卦表缺失：上${upper}下${lower}`)
  return h
}

/** 六爻 → 六十四卦（自下而上） */
export function hexagramByLines(lines: readonly Line[]): Hexagram {
  if (lines.length !== 6) throw new Error(`六爻卦必须有 6 爻，收到 ${lines.length}`)
  const lower = trigramByLines([lines[0], lines[1], lines[2]])
  const upper = trigramByLines([lines[3], lines[4], lines[5]])
  return hexagramByTrigrams(upper.name, lower.name)
}

export function hexagramByIndex(index: number): Hexagram {
  const h = HEXAGRAMS.find((x) => x.index === index)
  if (!h) throw new Error(`文王卦序必须是 1–64，收到 ${index}`)
  return h
}

/**
 * 五行生克（a 对 b 的作用）。
 * 五类齐全：生 / 克 / 被生 / 被克 / 同（比和）。
 * 只判单向会漏掉"被生 / 被克"，体用关系会算错。
 */
export type WuXingRelation = '生' | '克' | '被生' | '被克' | '同'

export function wuXingRelation(a: WuXing, b: WuXing): WuXingRelation {
  if (a === b) return '同'
  const sheng: Record<WuXing, WuXing> = { 金: '水', 木: '火', 水: '木', 火: '土', 土: '金' }
  const ke: Record<WuXing, WuXing> = { 金: '木', 木: '土', 水: '火', 火: '金', 土: '水' }
  if (sheng[a] === b) return '生'
  if (ke[a] === b) return '克'
  if (sheng[b] === a) return '被生'
  if (ke[b] === a) return '被克'
  return '同'
}

/** 爻象文本（自下而上渲染时请 reverse） */
export function lineText(l: Line): string {
  return l ? '—' : '--'
}
