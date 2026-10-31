import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRandomSource } from '@/engine/random'
import type { RandomSource } from '@/engine/types'
import {
  lotsEngine,
  setLotsContentProvider,
  type LotsContentEntry
} from '@/engine/lots'

function fixedRng(seedText: string): RandomSource {
  return createRandomSource(seedText)
}

const SAMPLE: LotsContentEntry = {
  index: 23,
  title: '第二十三签 · 上吉',
  poem: '诗曰：春风得意马蹄疾',
  prose: '解曰：诸事顺遂',
  source: { name: '示例古籍', license: 'public-domain', note: '示例' }
}

describe('签占引擎 lots.sign', () => {
  beforeEach(() => setLotsContentProvider(null))
  afterEach(() => setLotsContentProvider(null))

  it('compute 抽签范围恒为 1–100，且同一固定种子可复现', () => {
    const rng = fixedRng('lots-seed')
    for (let i = 0; i < 50; i++) {
      const r = lotsEngine.compute({}, rng)
      expect(r.index).toBeGreaterThanOrEqual(1)
      expect(r.index).toBeLessThanOrEqual(100)
    }
    // 复现性
    const a = lotsEngine.compute({}, fixedRng('lots-seed'))
    const b = lotsEngine.compute({}, fixedRng('lots-seed'))
    expect(a.index).toBe(b.index)
  })

  it('母版未装载时走 L3 兜底：只给签号，不编造签文', () => {
    const r = lotsEngine.compute({}, fixedRng('x'))
    const interp = lotsEngine.interpret(r)
    expect(interp.degraded).toContain('pending')
    expect(interp.source).toBe('签文暂未收录')
    // 兜底文案明确说明签文暂未收录，且不出现任何伪造签诗
    expect(interp.summary).toContain('暂未收录')
    expect(interp.blocks.some((b) => b.level === 'l1' && (b.text.includes('诗曰') || b.text.includes('解曰')))).toBe(false)
  })

  it('母版注入后按签号返回签诗，并记录出处与流派', () => {
    setLotsContentProvider((idx) => (idx === 23 ? SAMPLE : undefined))
    // 直接构造结果验证 interpret（抽签随机性另测）
    const interp = lotsEngine.interpret({ index: 23 })
    expect(interp.title).toBe('第二十三签 · 上吉')
    expect(interp.blocks.find((b) => b.key === 'poem')?.text).toBe(SAMPLE.poem)
    expect(interp.source).toBe('示例古籍:public-domain')
    expect(interp.basis).toEqual({ index: 23 })
  })
})
