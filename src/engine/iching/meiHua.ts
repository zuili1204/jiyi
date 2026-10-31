import {
  hexagramByLines,
  hexagramByTrigrams,
  TRIGRAM_BY_NAME,
  wuXingRelation,
  type Hexagram,
  type Line,
  type Trigram,
  type TrigramName,
  type WuXing
} from './constants'
import type { CastResult } from './cast'

/**
 * 梅花体用互变（Y3-08）
 *
 * 口径（写死在注释里）：
 * 1. **体卦 / 用卦**：动爻所在的那个经卦为**用卦**，另一个为**体卦**（体 = 我，用 = 彼 / 事）。
 *    动爻在下卦（1–3）→ 下卦为用、上卦为体；动爻在上卦（4–6）→ 上卦为用、下卦为体。
 *    无动爻时以**下卦为体、上卦为用**（静卦占）。
 * 2. **互卦**：本卦的 2/3/4 爻 → 下互；3/4/5 爻 → 上互（爻位自下而上，1-based）。
 * 3. **变卦**：动爻阴阳互变后的卦；无动爻则无变卦。
 * 4. **体用关系**：用生体（吉）/ 比和（吉）/ 体克用（吉）/ 体生用（耗）/ 用克体（凶）。
 *
 * 纪律：本模块只算**结构与五行关系**，不写断语 —— 断语属内容母版（Y3-09），
 * 未装载时上层走 L3 兜底，不得在此编造吉凶措辞。
 */

export type TiYongRelation = '用生体' | '体生用' | '体克用' | '用克体' | '比和'

export interface MeiHuaResult {
  benGua: Hexagram
  /** 动爻阴阳互变后的卦 */
  bianGua?: Hexagram
  /** 本卦 2/3/4 + 3/4/5 爻组成 */
  huGua: Hexagram
  ti: { trigram: TrigramName; element: WuXing }
  yong: { trigram: TrigramName; element: WuXing }
  dongYao: number[]
  relation: TiYongRelation
}

/** 体用五行 → 关系（含吉凶倾向，供断语模板使用，不在此写断语） */
export function tiYongRelation(ti: WuXing, yong: WuXing): TiYongRelation {
  switch (wuXingRelation(yong, ti)) {
    case '生':
      return '用生体'
    case '克':
      return '用克体'
    case '被生':
      return '体生用'
    case '被克':
      return '体克用'
    default:
      return '比和'
  }
}

/** 取互卦：2/3/4 爻为下互，3/4/5 爻为上互 */
export function huGuaOf(lines: readonly Line[]): Hexagram {
  if (lines.length !== 6) throw new Error(`互卦需要 6 爻，收到 ${lines.length}`)
  const xia = [lines[1], lines[2], lines[3]]
  const shang = [lines[2], lines[3], lines[4]]
  const lower = trigramOf(xia)
  const upper = trigramOf(shang)
  return hexagramByTrigrams(upper.name, lower.name)
}

function trigramOf(lines: Line[]): Trigram {
  const t = Object.values(TRIGRAM_BY_NAME).find(
    (x) => x.lines[0] === lines[0] && x.lines[1] === lines[1] && x.lines[2] === lines[2]
  )
  if (!t) throw new Error('无法由爻象确定八卦')
  return t
}

/** 由起卦结果推导体用互变 */
export function meiHua(cast: CastResult): MeiHuaResult {
  const lines = cast.lines
  const benGua = hexagramByLines(lines)
  const upper = benGua.upper
  const lower = benGua.lower

  const dong = cast.dongYao[0] // 多动爻时取最下一爻（初爻优先），并在 basis 中注明
  const hasDong = typeof dong === 'number'
  // 动爻在下卦（1–3）→ 下为用；在上卦（4–6）→ 上为用；无动爻 → 下为体、上为用
  const yongName: TrigramName = hasDong ? (dong <= 3 ? lower : upper) : upper
  const tiName: TrigramName = hasDong ? (dong <= 3 ? upper : lower) : lower

  const ti = TRIGRAM_BY_NAME[tiName]
  const yong = TRIGRAM_BY_NAME[yongName]

  return {
    benGua,
    bianGua: cast.bianGua,
    huGua: huGuaOf(lines),
    ti: { trigram: ti.name, element: ti.element },
    yong: { trigram: yong.name, element: yong.element },
    dongYao: cast.dongYao,
    relation: tiYongRelation(ti.element, yong.element)
  }
}
