import { describe, it, expect } from 'vitest'
import {
  scanText,
  scanJson,
  hasBlock,
  COMPLIANCE_WORDS_VERSION,
  FAMILY_BY_KIND
} from '@/engine/compliance'

describe('合规词闸', () => {
  it('block 词命中（医疗）', () => {
    const hits = scanText('你可能会确诊某种疾病', 'bazi', 'x.1')
    expect(hits.length).toBeGreaterThan(0)
    expect(hasBlock(hits)).toBe(true)
  })

  it('block 词命中（绝对化）', () => {
    const hits = scanText('这件事必定发生', 'lots')
    expect(hits.some((h) => h.family === 'absolute' && h.level === 'block')).toBe(true)
  })

  it('warn 词不触发 block', () => {
    const hits = scanText('这命该如此', 'bazi')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((h) => h.level === 'warn')).toBe(true)
    expect(hasBlock(hits)).toBe(false)
  })

  it('无词命中返回空', () => {
    const hits = scanText('此事需结合自身情况审慎看待', 'lots')
    expect(hits).toHaveLength(0)
  })

  it('递归扫描 JSON', () => {
    const hits = scanJson({ a: { b: '买入股票必涨' } }, 'iching', 'root')
    expect(hits.some((h) => h.family === 'invest')).toBe(true)
    expect(hits[0].path).toBe('root.a.b')
  })

  it('各品类都启用了绝对化 block 词', () => {
    for (const k of Object.keys(FAMILY_BY_KIND) as (keyof typeof FAMILY_BY_KIND)[]) {
      expect(FAMILY_BY_KIND[k]).toContain('absolute')
    }
  })

  it('词表版本已声明', () => {
    expect(COMPLIANCE_WORDS_VERSION).toBeGreaterThan(0)
  })
})
