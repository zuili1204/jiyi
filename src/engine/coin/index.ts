import type { DivinationEngine, Interpretation, RandomSource } from '../types'
import { registerEngine } from '../registry'
import { currentDataVersion } from '@/platform/storage'

/**
 * 假品类「掷硬币」（Y1-15）
 *
 * 用途：在没有任何真实品类之前，跑通
 *   输入 → compute → interpret → 保存 → 历史 → 导出
 * 全链路，验证多品类抽象是否成立。
 *
 * 纪律：这只是验证工具，不是产品功能。
 * 正式品类接入后，本引擎应移除或标注 internal，不得污染统计与分享图分支。
 */

export const COIN_METHOD = 'coin'
export const COIN_KIND = 'lots' as const
export const COIN_INTERNAL = true

export interface CoinInput {
  question?: string
}

export interface CoinResult {
  face: 'up' | 'down'
  /** 单调递增的投掷序号，便于验证可复现性 */
  seq: number
}

export const coinEngine: DivinationEngine<CoinInput, CoinResult> = {
  kind: COIN_KIND,
  method: COIN_METHOD,

  compute(_input: CoinInput, rng: RandomSource): CoinResult {
    return { face: rng.int(2) === 0 ? 'up' : 'down', seq: rng.int(1_000_000) }
  },

  interpret(r: CoinResult): Interpretation {
    // 引擎零硬编码文案？此处为 internal 验证引擎，文案内联并显式标注，
    // 正式品类一律从 src/data/content 读取（JY-03 §2 纪律 2）。
    const text = r.face === 'up' ? '正面：可行。' : '反面：再想想。'
    return {
      title: '掷硬币（内部验证）',
      summary: text,
      blocks: [{ key: 'face', label: '结果', text, level: 'l1' }],
      basis: { face: r.face },
      source: 'internal:coin',
      school: 'none'
    }
  }
}

registerEngine(coinEngine)

/** 组装一条可落库的记录（供 store / 测试复用） */
export function buildCoinRecord(
  input: CoinInput,
  rng: RandomSource,
  id: string
): {
  id: string
  kind: typeof COIN_KIND
  method: string
  schemaVersion: number
  dataVersion: number
  createdAt: number
  input: Record<string, unknown>
  result: Record<string, unknown>
  interpretation: Interpretation
  piiFields: string[]
} {
  const result = coinEngine.compute(input, rng)
  return {
    id,
    kind: COIN_KIND,
    method: COIN_METHOD,
    schemaVersion: 1,
    dataVersion: currentDataVersion(),
    createdAt: Date.now(),
    input: { ...input },
    result: result as unknown as Record<string, unknown>,
    interpretation: coinEngine.interpret(result),
    piiFields: []
  }
}
