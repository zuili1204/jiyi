import { describe, expect, it } from 'vitest'
import { scanAiOutput } from '@/engine/ai/scan'

/**
 * AI 输出后检（JY-07 §6 / §9-3）：只标记，不改写
 */

describe('scanAiOutput（后检只标记不改写）', () => {
  it('命中禁词：记录词族，原文保留', () => {
    const text = '这波行情建议买入，一定会涨停。'
    const { flagged, hits } = scanAiOutput(text, 'lots')
    expect(flagged).toContain('invest')
    expect(flagged).toContain('absolute')
    expect(hits.length).toBeGreaterThan(0)
    // 只标记不改写：函数不产出替换文本，原文由调用方原样保留（client 侧断言见 ai-client.spec）
  })

  it('干净文本：flagged 为空', () => {
    const { flagged } = scanAiOutput('今天适合出行，路上注意休息。', 'lots')
    expect(flagged).toEqual([])
  })

  it('词族按品类启用：yingqi 不检 lots、检 iching', () => {
    const text = '此事三个月内必有转机。'
    expect(scanAiOutput(text, 'lots').flagged).toEqual([])
    expect(scanAiOutput(text, 'iching').flagged).toEqual(['yingqi'])
  })

  it('AI 输出不走传统原文豁免：医疗类表述照样命中', () => {
    // 「治疗 / 痊愈」属 medical 词族；内容 JSON 里的签谱原文有豁免，AI 输出没有
    const text = '此事如病，需及时治疗，方可痊愈。'
    const { flagged } = scanAiOutput(text, 'lots')
    expect(flagged).toContain('medical')
  })
})
