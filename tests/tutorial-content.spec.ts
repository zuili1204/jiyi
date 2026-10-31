import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { scanJson, hasBlock, missingProvenance } from '@/engine/compliance'
import {
  introItems,
  methods,
  guideEntries,
  figureItems,
  operationEntries,
  complianceEntries,
  methodByKey
} from '@/data/content/tutorial'
import { CATEGORIES } from '@/data/categories'

/**
 * 教程内容契约（JY-14 §5，T5）
 * - 六玩法字段齐全、key 与 JY-01 品类对齐
 * - 决策指南 / 操作 / 合规齐全
 * - 内容闸：教程自撰文案走全词族严扫，0 block
 */
const MASTER = join(process.cwd(), 'DOCS', 'content', 'tutorial', 'tutorial.json')
/** 发布仓库不提供内容母版：仅"母版实测"用例跳过，其余走已入库快照 */
const hasMaster = existsSync(MASTER)

function masterDoc(): Record<string, unknown> {
  return JSON.parse(readFileSync(MASTER, 'utf8')) as Record<string, unknown>
}

describe('教程内容契约', () => {
  it.skipIf(!hasMaster)('母版存在且 kind=tutorial', () => {
    const doc = masterDoc()
    expect(doc.kind).toBe('tutorial')
    expect(Array.isArray(doc.items)).toBe(true)
  })

  it('产物：六玩法、有 intro、有决策指南', () => {
    expect(methods.length).toBe(6)
    expect(introItems.length).toBeGreaterThan(0)
    expect(guideEntries.length).toBeGreaterThan(0)
    expect(operationEntries.length).toBeGreaterThan(0)
  })

  it('六玩法 key 与 JY-01 品类矩阵一致（防漂移）', () => {
    const categoryKeys = new Set(CATEGORIES.map((c) => c.key))
    for (const m of methods) {
      expect(categoryKeys.has(m.key)).toBe(true)
      expect(m.name.length).toBeGreaterThan(0)
      expect(m.input.length).toBeGreaterThan(0)
      expect(m.output.length).toBeGreaterThan(0)
    }
  })

  it('六玩法 status 只允许 ready / partial（状态护栏）', () => {
    for (const m of methods) {
      expect(['ready', 'partial']).toContain(m.status)
    }
  })

  it('图示条目 8 条且讲解字段齐全', () => {
    expect(figureItems.length).toBe(8)
    for (const f of figureItems) {
      expect(f.name.length).toBeGreaterThan(0)
      expect(f.brief.length).toBeGreaterThan(0)
      expect(f.detail.length).toBeGreaterThan(0)
    }
  })

  it('决策指南推荐键可解析到玩法', () => {
    const guide = guideEntries[0]
    expect(guide).toBeDefined()
    expect(guide.items.length).toBeGreaterThan(0)
    for (const item of guide.items) {
      for (const key of item.recommend) {
        expect(methodByKey(key)).toBeDefined()
      }
    }
  })

  it('操作指引与合规须知结构齐全（有步骤 / 有免责）', () => {
    const stepCount = operationEntries.reduce((n, o) => n + o.steps.length, 0)
    expect(stepCount).toBeGreaterThan(0)
    const c = complianceEntries[0]
    expect(c).toBeDefined()
    expect(c.disclaimer.length).toBeGreaterThan(0)
    expect(c.age.length).toBeGreaterThan(0)
    expect(c.dataLocal.length).toBeGreaterThan(0)
  })

  it.skipIf(!hasMaster)('内容闸：教程自撰文案走全词族严扫，0 block', () => {
    const doc = masterDoc()
    expect(missingProvenance(doc, ['source', 'license', 'school'])).toEqual([])
    const hits = scanJson(doc, 'tutorial')
    expect(hasBlock(hits)).toBe(false)
  })
})