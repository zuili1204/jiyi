import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  scanJson,
  scanText,
  hasBlock,
  findExemption,
  matchPathPattern,
  missingProvenance,
  COMPLIANCE_EXEMPTIONS
} from '@/engine/compliance'
import { getLotEntry, LOT_KINDS } from '@/data/content/lots'

/**
 * 内容闸「传统原文豁免」契约测试（Y2-08 / JY-04 §3.4）
 *
 * 核心命题：**豁免不等于关闸**。
 * 传统签谱原文含「病」「孕」「生男」等表述，必须与本产品的现代译注区别对待：
 *   - 原文路径 → 豁免词族扫描，但改走「溯源 / 占位 / 叠词 / 长度」等价强度检查；
 *   - 译注路径 → 全词族严检，绝不因豁免而放行。
 */
const MASTER_DIR = join(process.cwd(), 'DOCS', 'content', 'lots')
/** 发布仓库不提供内容母版：母版实测整组跳过，并在报告中留下可见的 skip */
const hasLotsMasters = existsSync(MASTER_DIR)
/** describe 即使被 skip 也会执行回调体，因此文件枚举必须放在守卫外且可空 */
const lotMasterFiles = hasLotsMasters ? masterFiles() : []

function masterFiles(): string[] {
  return readdirSync(MASTER_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => join(MASTER_DIR, f))
}

describe('路径通配匹配', () => {
  it('* 匹配数组下标', () => {
    expect(matchPathPattern('items[*].poem[*]', 'items[0].poem[3]')).toBe(true)
    expect(matchPathPattern('items[*].poem[*]', 'items[0].story')).toBe(false)
    expect(matchPathPattern('items[*].story', 'items[99].story')).toBe(true)
  })

  it('段数不同不匹配', () => {
    expect(matchPathPattern('items[*].poem[*]', 'items[0]')).toBe(false)
  })
})

describe('传统原文豁免', () => {
  const originalDoc = {
    version: 1,
    kind: 'lots',
    source: '某签谱',
    license: '公有领域',
    school: '通行本',
    items: [
      { id: 'x-001', poem: ['病即安然'], interpretation: '六甲生男，病得痊愈', story: '钟离成道' }
    ]
  }

  it('签诗 / 解曰 / 典故原文命中豁免，不 block', () => {
    const hits = scanJson(originalDoc, 'lots')
    expect(hasBlock(hits)).toBe(false)
  })

  it('豁免命中可审计（计数与规则 id）', () => {
    const audit = { count: 0, byId: {} as Record<string, number> }
    scanJson(originalDoc, 'lots', '', { exemptAudit: audit })
    expect(audit.count).toBeGreaterThan(0)
    expect(audit.byId['lots.classicalOriginal']).toBeGreaterThan(0)
  })

  it('关闭豁免后原文仍受全词族约束（证明豁免真的在起作用）', () => {
    const hits = scanJson(originalDoc, 'lots', '', { disableExemption: true })
    expect(hasBlock(hits)).toBe(true)
  })

  it('豁免只按路径生效：译注字段绝不放行', () => {
    const doc = {
      ...originalDoc,
      items: [
        {
          id: 'x-001',
          poem: ['无关内容'],
          interpretation: '无关内容',
          modernNote: '你一定会痊愈，必生男' // 现代译注：非豁免路径
        }
      ]
    }
    const hits = scanJson(doc, 'lots')
    expect(hasBlock(hits)).toBe(true)
    expect(hits.some((h) => h.family === 'medical' || h.family === 'gender')).toBe(true)
  })

  it('替代检查仍生效：豁免字段残留占位符照样 block', () => {
    const doc = { ...originalDoc, items: [{ id: 'x-001', poem: ['待补'], interpretation: 'x' }] }
    const hits = scanJson(doc, 'lots')
    expect(hasBlock(hits)).toBe(true)
    expect(hits.some((h) => h.family === 'placeholder')).toBe(true)
  })

  it('溯源校验：母版缺 source / license / school 时豁免失效条件成立', () => {
    expect(missingProvenance({ source: 'a', license: 'b', school: 'c' }, ['source', 'license', 'school'])).toEqual([])
    expect(missingProvenance({ source: 'a' }, ['source', 'license', 'school'])).toEqual(['license', 'school'])
    expect(missingProvenance({ source: 'unknown', license: 'b', school: 'c' }, ['source'])).toEqual(['source'])
  })

  it('豁免规则声明了替代检查项（不允许空口豁免）', () => {
    for (const e of COMPLIANCE_EXEMPTIONS) {
      expect(e.reason.length).toBeGreaterThan(0)
      expect(e.alternativeChecks.length).toBeGreaterThan(0)
      expect(e.requires.length).toBeGreaterThan(0)
    }
  })

  it('findExemption 对非 lots 品类不生效', () => {
    expect(findExemption('lots', 'items[0].interpretation')).toBeDefined()
    expect(findExemption('bazi', 'items[0].interpretation')).toBeUndefined()
  })

  it('scanText 直接调用时同样尊重豁免', () => {
    expect(scanText('六甲生男', 'lots', 'items[0].interpretation')).toHaveLength(0)
    expect(scanText('六甲生男', 'lots', 'items[0].modernNote').length).toBeGreaterThan(0)
  })
})

describe.skipIf(!hasLotsMasters)('母版实测（DOCS/content/lots）', () => {
  it('母版存在且三套齐全', () => {
    expect(masterFiles()).toHaveLength(3)
  })

  for (const file of lotMasterFiles) {
    it(`${file.split(/[\\/]/).pop()} 过闸：block 0（豁免 + 替代检查）`, () => {
      const doc = JSON.parse(readFileSync(file, 'utf8'))
      expect(missingProvenance(doc, ['source', 'license', 'school'])).toEqual([])
      const hits = scanJson(doc, 'lots')
      expect(hasBlock(hits)).toBe(false)
    })
  }

  it('关闭豁免后母版确实会被 block（反向证明豁免不可省）', () => {
    const doc = JSON.parse(readFileSync(masterFiles()[0], 'utf8'))
    const hits = scanJson(doc, 'lots', '', { disableExemption: true })
    expect(hasBlock(hits)).toBe(true)
  })

  it('同步产物与母版条目数一致（300 签）', () => {
    let masterItems = 0
    for (const f of masterFiles()) {
      masterItems += JSON.parse(readFileSync(f, 'utf8')).items.length
    }
    expect(masterItems).toBe(300)
    for (const { kind } of LOT_KINDS) {
      for (let n = 1; n <= 100; n++) expect(getLotEntry(n, kind)).toBeDefined()
    }
  })
})
