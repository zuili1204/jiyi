/**
 * 引擎层公共类型（JY-03 §5 唯一权威源）
 *
 * 纪律：engine 不碰 DOM，输入输出都是 JSON。
 */

export type DivinationKind = 'lots' | 'iching' | 'bazi' | 'ziwei' | 'qimen'

export const DIVINATION_KINDS: readonly DivinationKind[] = [
  'lots',
  'iching',
  'bazi',
  'ziwei',
  'qimen'
]

export function isDivinationKind(v: unknown): v is DivinationKind {
  return typeof v === 'string' && (DIVINATION_KINDS as readonly string[]).includes(v)
}

/** 随机源：单一注入口，便于固定种子单测（JY-03 §5） */
export interface RandomSource {
  /** [0, 1) */
  next(): number
  /** [0, maxExclusive) 均匀整数 */
  int(maxExclusive: number): number
  /** 测试期固定种子；生产环境为 undefined */
  readonly seed?: string
}

/** 解读文本的一个分块 */
export interface InterpretationBlock {
  key: string
  label: string
  text: string
  /** L1 具体条目 / L2 组合模板 / L3 通用兜底（JY-01 §3） */
  level?: 'l1' | 'l2' | 'l3'
}

export interface Interpretation {
  title: string
  summary: string
  blocks: InterpretationBlock[]
  /** 排盘依据：随记录落库，供用户核验（JY-02 §7） */
  basis?: Record<string, unknown>
  /** 命中 L3 兜底的条目键，用于统计兜底率（JY-01 §3 纪律 4） */
  degraded?: string[]
  /** 内容出处（古籍版本 / 庙宇版本） */
  source?: string
  /** 所采流派，须与 JY-01 §7 字面一致 */
  school?: string
}

export interface InterpretContext {
  /** 用户问事文本（可能为空） */
  question?: string
  locale?: string
}

export interface DivinationEngine<I = unknown, R = unknown> {
  readonly kind: DivinationKind
  /** 子玩法键，一经启用不得改名（JY-01 §1.1） */
  readonly method: string
  /** 确定性排盘 / 随机起卦 */
  compute(input: I, rng: RandomSource): R
  /** 结构化结果 → 解读文本 */
  interpret(r: R, ctx?: InterpretContext): Interpretation
}
