import { describe, it, expect, afterEach } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { setBaziDuanProvider, baziEngine } from '@/engine/bazi'
import { getBaziDuanEntries, baziDuanItems, BAZI_DUAN_META } from '@/data/content/bazi'
import { scanJson, hasBlock } from '@/engine/compliance'

/**
 * 八字断语母版（Y4-10 + Y4-06 分项模板）
 *
 * 「自撰的白话断条」不属于古籍原文，因此**不豁免**，仍走全词族严检（JY-01 §7 纪律 2）。
 * 本文件的核心是：母版结构 / 断条不命中违规词 / 引擎注入后 L2 升级 / 未过核校可见提示。
 */
const MASTER = join(process.cwd(), 'DOCS', 'content', 'bazi', 'duanYu.json')
/** 发布仓库不提供内容母版：仅"母版实测"用例跳过，其余走已入库快照 */
const hasMaster = existsSync(MASTER)

afterEach(() => setBaziDuanProvider(null))

/** 提供注入后的 provider 包装（复用 bootstrap 逻辑的等价实现） */
function withProvider() {
  setBaziDuanProvider((ctx) =>
    getBaziDuanEntries({
      weak: ctx.weak,
      moderate: ctx.moderate,
      shiShen: ctx.monthShiShen
    }).map((e) => ({
      id: e.id,
      title: e.title,
      text: e.text,
      reviewed: BAZI_DUAN_META.reviewed,
      source: { name: BAZI_DUAN_META.source, license: BAZI_DUAN_META.license }
    }))
  )
}

/** 取一条测试八字，保证 compute 链可跑（扁平 BaziInput：year/month/day/hour/minute/gender） */
const SAMPLE_INPUT = {
  year: 1990,
  month: 6,
  day: 15,
  hour: 10,
  minute: 0,
  gender: 'male' as const
}

describe('母版结构', () => {
  it('四类条目覆盖完备：强弱 3 档 / 十神 10 种 / 整体兜底', () => {
    const strength = baziDuanItems.filter((i) => i.dimension === 'strength')
    const shiShen = baziDuanItems.filter((i) => i.dimension === 'shiShen')
    const overall = baziDuanItems.filter((i) => i.dimension === 'overall')
    // 强弱档
    expect(strength.some((i) => i.strength === 'strong')).toBe(true)
    expect(strength.some((i) => i.strength === 'moderate')).toBe(true)
    expect(strength.some((i) => i.strength === 'weak')).toBe(true)
    // 十神十类（比肩/劫财/食神/伤官/正财/偏财/正官/七杀/正印/偏印）
    expect(shiShen.length).toBe(10)
    // 兜底
    expect(overall).toHaveLength(1)
  })

  it('id 唯一', () => {
    const ids = new Set(baziDuanItems.map((i) => i.id))
    expect(ids.size).toBe(baziDuanItems.length)
  })

  it('母版声明了出处与许可，且未核验状态可见', () => {
    expect(BAZI_DUAN_META.source).toBeTruthy()
    expect(BAZI_DUAN_META.license).toBeTruthy()
    expect(BAZI_DUAN_META.school).toBeTruthy()
    expect(BAZI_DUAN_META.reviewed).toBe(false)
  })

  it.skipIf(!hasMaster)('母版文件实物与产物条目数一致（sync 闭环）', () => {
    const doc = JSON.parse(readFileSync(MASTER, 'utf8'))
    expect(doc.items).toHaveLength(baziDuanItems.length)
    expect(doc.reviewed).toBe(false)
  })
})

describe('内容闸：自撰断条不走豁免，仍过全词族严检', () => {
  it('所有断条不含违规词（无 block）', () => {
    const doc = { items: baziDuanItems.map((i) => ({ text: i.text })) }
    const hits = scanJson(doc, 'bazi')
    expect(hasBlock(hits)).toBe(false)
  })

  it('反向验证：塞一个医疗类 block 词会被拦下', () => {
    const bad = { items: [{ text: '宜保持心态，此局主痊愈之象' }] }
    const hits = scanJson(bad, 'bazi')
    expect(hasBlock(hits)).toBe(true)
    expect(hits.some((h) => h.family === 'medical')).toBe(true)
  })
})

describe('引擎注入', () => {
  it('母版装载后结果升级为 L2：含强弱提示与十神参考', () => {
    withProvider()
    const r = baziEngine.compute(SAMPLE_INPUT, {
      next: () => 0,
      int: () => 0
    })
    const it = baziEngine.interpret(r)
    const duanBlocks = it.blocks.filter((b) => b.key.startsWith('duan-'))
    expect(duanBlocks.length).toBeGreaterThanOrEqual(2) // 强弱 + 十神
    expect(duanBlocks.every((b) => b.level === 'l2')).toBe(true)
  })

  it('未过核校时必须带可见提示（不得宣称权威）', () => {
    withProvider()
    const r = baziEngine.compute(SAMPLE_INPUT, {
      next: () => 0,
      int: () => 0
    })
    const it = baziEngine.interpret(r)
    const caveat = it.blocks.find((b) => b.key === 'duanCaveat')
    expect(caveat).toBeDefined()
    expect(caveat!.text).toContain('通行参考')
  })

  it('未注入 provider 时无断语块（降级，不编造）', () => {
    const r = baziEngine.compute(SAMPLE_INPUT, {
      next: () => 0,
      int: () => 0
    })
    const it = baziEngine.interpret(r)
    expect(it.blocks.some((b) => b.key.startsWith('duan-'))).toBe(false)
  })
})