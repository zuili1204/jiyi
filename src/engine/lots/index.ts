import type {
  DivinationEngine,
  Interpretation,
  InterpretationBlock,
  InterpretContext,
  RandomSource
} from '../types'
import { registerEngine } from '../registry'
import type { InputSchema } from '@/types/input'
import { currentDataVersion } from '@/platform/storage'
import type { ReadingRecord } from '@/types/reading'

/**
 * 签占引擎（Y2-01）：「抽签」子玩法。
 *
 * 纪律：
 * - compute 只做随机抽签（1–100），确定性来自注入的 RandomSource。
 * - interpret **绝不硬编码签文**；签诗母版由内容提供方注入（JY-04）。
 *   母版未装载时走 L3 兜底：只返回签号并明确标注「母版未装载」，
 *   不编造任何签文 / 解曰（避免虚构内容污染产品）。
 * - 母版需带 source（古籍版本 / 庙宇版本）+ license，否则不予采用。
 */

export const LOTS_KIND = 'lots' as const
export const LOTS_METHOD = 'sign'

/** 签占套系（决定抽取哪一套签诗母版） */
export type LotKind = 'guanyin' | 'guandi' | 'lvzu'

export interface LotsInput {
  /** 心中所问，可选；非 PII，随记录保存 */
  note?: string
  /** 抽哪一套签：观音 / 关帝 / 吕祖，缺省观音 */
  kind?: LotKind
}

export interface LotsResult {
  /** 签号 1–100 */
  index: number
  /** 抽中的签套系 */
  kind?: LotKind
}

/** 单条签诗母版（由内容提供方注入；来自权威古籍/庙宇版本，须带 license） */
export interface LotsContentEntry {
  index: number
  title: string
  poem?: string
  prose?: string
  /** 典故（古人事迹），可选；有则在结果页单独成块 */
  story?: string
  source: { name: string; license: string; note?: string }
}

export type LotsContentProvider = (
  index: number,
  kind?: string
) => LotsContentEntry | undefined

let contentProvider: LotsContentProvider | null = null

/** 注入签诗母版提供方（由内容加载层在母版就绪后调用） */
export function setLotsContentProvider(p: LotsContentProvider | null): void {
  contentProvider = p
}

export const LOTS_SCHEMA: InputSchema = {
  fields: [
    { key: 'note', label: '心中所问（可选）', type: 'text', required: false }
  ]
}

export const lotsEngine: DivinationEngine<LotsInput, LotsResult> = {
  kind: LOTS_KIND,
  method: LOTS_METHOD,

  compute(input: LotsInput, rng: RandomSource): LotsResult {
    return { index: rng.int(100) + 1, kind: input.kind }
  },

  interpret(r: LotsResult, _ctx?: InterpretContext): Interpretation {
    const entry = contentProvider ? contentProvider(r.index, r.kind) : undefined

    // L3 兜底：母版未装载或该签号缺内容，只回签号，不编造。
    if (!entry) {
      return {
        title: `第 ${r.index} 签`,
        summary: `第 ${r.index} 签（签文暂未收录）`,
        blocks: [
          {
            key: 'pending',
            label: '状态',
            text: '签文暂未收录，敬请期待。',
            level: 'l3'
          }
        ],
        basis: { index: r.index },
        degraded: ['pending'],
        source: '签文暂未收录',
        school: '通行本'
      }
    }

    const blocks: InterpretationBlock[] = []
    if (entry.poem) blocks.push({ key: 'poem', label: '签诗', text: entry.poem, level: 'l1' })
    if (entry.prose) blocks.push({ key: 'prose', label: '解曰', text: entry.prose, level: 'l1' })
    if (entry.story) blocks.push({ key: 'story', label: '典故', text: entry.story, level: 'l1' })
    blocks.push({
      key: 'source',
      label: '出处',
      text: `${entry.source.name}；${entry.source.license}`,
      level: 'l1'
    })

    return {
      title: entry.title,
      summary: entry.poem ?? entry.prose ?? entry.title,
      blocks,
      basis: { index: r.index },
      source: `${entry.source.name}:${entry.source.license}`,
      school: entry.source.note ?? 'default'
    }
  }
}

registerEngine(lotsEngine)

/** 组装一条可落库的签占记录（供 store / 测试复用） */
export function buildLotsRecord(
  input: LotsInput,
  rng: RandomSource,
  id: string
): ReadingRecord {
  const result = lotsEngine.compute(input, rng)
  return {
    id,
    kind: LOTS_KIND,
    method: LOTS_METHOD,
    schemaVersion: 1,
    dataVersion: currentDataVersion(),
    createdAt: Date.now(),
    input: { ...input },
    result: result as unknown as Record<string, unknown>,
    interpretation: lotsEngine.interpret(result),
    piiFields: []
  }
}
