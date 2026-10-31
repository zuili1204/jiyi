import { describe, it, expect } from 'vitest'
import { buildCoinRecord, coinEngine } from '@/engine/coin'
import { createRandomSource } from '@/engine/random'
import { getEngine, __clearRegistry, registerEngine } from '@/engine/registry'
import { SCHEMA_VERSION } from '@/types/reading'

describe('硬币假品类全链路', () => {
  it('引擎已注册', () => {
    __clearRegistry()
    registerEngine(coinEngine)
    const e = getEngine('lots', 'coin')
    expect(e).toBeDefined()
    expect(e?.method).toBe('coin')
  })

  it('compute 产出确定性结果（同一 seed 可复现）', () => {
    const a = coinEngine.compute({}, createRandomSource('s'))
    const b = coinEngine.compute({}, createRandomSource('s'))
    expect(a).toEqual(b)
  })

  it('interpret 产出结构化解读', () => {
    const r = coinEngine.compute({}, createRandomSource('s'))
    const i = coinEngine.interpret(r)
    expect(i.title).toBeTruthy()
    expect(i.blocks.length).toBeGreaterThan(0)
    expect(i.basis).toBeDefined()
  })

  it('buildCoinRecord 产出可落库记录', () => {
    __clearRegistry()
    registerEngine(coinEngine)
    const rec = buildCoinRecord({ question: 'q' }, createRandomSource(), 'id-1')
    expect(rec.id).toBe('id-1')
    expect(rec.kind).toBe('lots')
    expect(rec.schemaVersion).toBe(SCHEMA_VERSION)
    expect(rec.interpretation.blocks.length).toBeGreaterThan(0)
  })
})
