import { describe, it, expect } from 'vitest'
import { createRandomSource } from '@/engine/random'

describe('RandomSource', () => {
  it('固定种子可复现', () => {
    const a = createRandomSource('seed-x')
    const b = createRandomSource('seed-x')
    const seqA = Array.from({ length: 5 }, () => a.next())
    const seqB = Array.from({ length: 5 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })

  it('不同种子分布不同', () => {
    const a = createRandomSource('seed-x')
    const b = createRandomSource('seed-y')
    expect(a.next()).not.toEqual(b.next())
  })

  it('next() 落在 [0,1)', () => {
    const r = createRandomSource('t')
    for (let i = 0; i < 1000; i++) {
      const v = r.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('int() 落在 [0,max)', () => {
    const r = createRandomSource('t2')
    for (let i = 0; i < 1000; i++) {
      const v = r.int(6)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(6)
      expect(Number.isInteger(v)).toBe(true)
    }
  })

  it('int() 拒绝非正整数', () => {
    const r = createRandomSource('t3')
    expect(() => r.int(0)).toThrow()
    expect(() => r.int(-1)).toThrow()
  })

  it('分布大致无偏（int(2) 接近 50/50）', () => {
    const r = createRandomSource('bias')
    const counts = [0, 0]
    const n = 20000
    for (let i = 0; i < n; i++) counts[r.int(2)]++
    const ratio = counts[0] / n
    expect(Math.abs(ratio - 0.5)).toBeLessThan(0.05)
  })
})
