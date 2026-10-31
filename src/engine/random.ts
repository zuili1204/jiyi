import type { RandomSource } from './types'

/**
 * 随机源（JY-03 §5 / §6）
 *
 * - 生产：crypto.getRandomValues（加密级，"诚实随机"可对外说明）
 * - 测试：注入固定种子（mulberry32），用于验证分布无偏
 */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 字符串 → 32 位种子 */
function hashSeed(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function createRandomSource(seed?: string): RandomSource {
  if (seed !== undefined) {
    const next = mulberry32(hashSeed(seed))
    return {
      next,
      int: (maxExclusive: number) => {
        if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
          throw new Error(`int() 需要正整数，收到 ${maxExclusive}`)
        }
        return Math.floor(next() * maxExclusive)
      },
      seed
    }
  }

  const cryptoObj: Crypto | undefined =
    typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto) : undefined

  return {
    next(): number {
      if (cryptoObj?.getRandomValues) {
        const buf = new Uint32Array(1)
        cryptoObj.getRandomValues(buf)
        return buf[0] / 4294967296
      }
      // 无 crypto 环境（极端降级）：明确抛错而不是静默用 Math.random
      throw new Error('当前环境不支持 crypto.getRandomValues')
    },
    int(maxExclusive: number): number {
      if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
        throw new Error(`int() 需要正整数，收到 ${maxExclusive}`)
      }
      if (cryptoObj?.getRandomValues) {
        // 拒绝采样，避免取模偏差（"分布无偏"是验收项，JY-05 Y2）
        const limit = Math.floor(4294967296 / maxExclusive) * maxExclusive
        const buf = new Uint32Array(1)
        for (let i = 0; i < 64; i++) {
          cryptoObj.getRandomValues(buf)
          if (buf[0] < limit) return buf[0] % maxExclusive
        }
      }
      throw new Error('无法生成无偏随机整数')
    }
  }
}
