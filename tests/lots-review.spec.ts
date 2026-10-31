import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { lotGrade, LOT_KINDS, getLotEntry, type LotKind } from '@/data/content/lots'

/**
 * 横向审校（Y2-11）：把"人看一遍"沉淀为可复跑的不变量。
 *
 * 关注四类串味风险：
 *   ① 等级口径不一致（三套用了不同等级体系）→ 统一到三档
 *   ② 套系之间串签
 *   ③ 吉凶分布异常集中
 *   ④ 内容缺件（缺签诗 / 缺解曰）
 */
const MASTER_DIR = join(process.cwd(), 'DOCS', 'content', 'lots')
/** 发布仓库不提供内容母版：依赖母版的审校整组跳过 */
const hasLotsMasters = existsSync(MASTER_DIR)

interface MasterDoc {
  set: string
  items: { id: string; number: number; level: string; levelSource?: string; poem: string[]; interpretation: string; story?: string }[]
}

function load(set: string): MasterDoc {
  return JSON.parse(readFileSync(join(MASTER_DIR, `${set}.json`), 'utf8')) as MasterDoc
}

describe.skipIf(!hasLotsMasters)('等级口径统一（Y2-11 审校发现）', () => {
  it('三套等级体系确实不同（这正是必须归一的原因）', () => {
    const levels = new Set<string>()
    for (const { kind } of LOT_KINDS) {
      for (const it of load(kind).items) levels.add(it.level)
    }
    // 观音：上/中/下签；关帝、吕祖：大吉/上上/上吉/中吉/中平/中下/下下
    expect(levels.has('上签')).toBe(true)
    expect(levels.has('下下')).toBe(true)
    expect(levels.size).toBeGreaterThan(3)
  })

  for (const { kind } of LOT_KINDS) {
    it(`[${kind}] 100 签等级全部可映射到三档（无未知等级）`, () => {
      for (const it of load(kind).items) {
        expect(lotGrade(it.level), `${kind} #${it.number} 等级「${it.level}」无法映射`).toBeDefined()
      }
    })

    it(`[${kind}] 吉凶分布无异常集中（单一档不超过 80%）`, () => {
      const doc = load(kind)
      const tally = { ji: 0, zhong: 0, xiong: 0 }
      for (const it of doc.items) {
        const g = lotGrade(it.level)!
        tally[g] += 1
      }
      const max = Math.max(tally.ji, tally.zhong, tally.xiong)
      expect(max / doc.items.length).toBeLessThan(0.8)
    })
  }

  it('吕祖推断等级已标注来源（其余两套为源站自带等级）', () => {
    const lvzu = load('lvzu').items
    const inferred = lvzu.filter((i) => i.levelSource === 'inferred')
    expect(inferred.length).toBeGreaterThan(0)
    for (const i of lvzu) expect(['source', 'inferred']).toContain(i.levelSource)
  })
})

describe.skipIf(!hasLotsMasters)('套系不串签', () => {
  it('同一签号在三套下标题不同、签诗不同', () => {
    for (const n of [1, 13, 50, 88, 100]) {
      const [g, d, l] = (['guanyin', 'guandi', 'lvzu'] as LotKind[]).map((k) => getLotEntry(n, k)!)
      expect(new Set([g.poem, d.poem, l.poem]).size).toBe(3)
    }
  })

  it('母版文件恰好三套，且 items 各 100 条', () => {
    const files = readdirSync(MASTER_DIR).filter((f) => f.endsWith('.json'))
    expect(files).toHaveLength(3)
    for (const { kind } of LOT_KINDS) expect(load(kind).items).toHaveLength(100)
  })
})

describe.skipIf(!hasLotsMasters)('内容缺件检查', () => {
  for (const { kind } of LOT_KINDS) {
    it(`[${kind}] 无缺签诗 / 缺解曰`, () => {
      for (const it of load(kind).items) {
        expect(it.poem?.length ?? 0, `${kind} #${it.number} 缺签诗`).toBeGreaterThan(0)
        expect(it.interpretation?.length ?? 0, `${kind} #${it.number} 缺解曰`).toBeGreaterThan(0)
      }
    })
  }

  it('关帝无典故（已知差异，结果页按条件渲染）', () => {
    expect(load('guandi').items.every((i) => !i.story)).toBe(true)
    expect(load('guanyin').items.every((i) => !!i.story)).toBe(true)
  })
})
