import { describe, it, expect, beforeAll } from 'vitest'
import {
  ichingLiujiaoEngine,
  setIchingTextProvider,
  setIchingTemplateProvider,
  setIchingYiLiProvider
} from '@/engine/iching'
import { bootstrapContent } from '@/data/content/bootstrap'
import { lineTextItems, hexagramTextItems } from '@/data/content/iching'

/**
 * Y3-13 卜筮横向审校（守护测试）
 *
 * 审校两条主线：
 * 1. **体系不串用**：卦爻辞（内容层，《周易》文本）与纳甲 / 旺衰 / 判读（京房八宫 +《增删卜易》）
 *    各自带**独立**的核校披露，互不充当对方的依据；
 * 2. **无未本地化残留**：结果全文不得出现 TODO / 待补 / 待填 / undefined / [object 之类。
 *
 * 另锁一条：内容母版缺失时走 L3 —— 卦爻辞块消失，但装卦 / 旺衰结构照旧（不串味、不编造）。
 */
const rng = { next: () => 0.5, int: (m: number) => Math.floor(m * 0.5) }
const AT = { year: 2024, month: 3, day: 20, hour: 10, minute: 30 }

function interp() {
  const r = ichingLiujiaoEngine.compute({ at: AT }, rng)
  return ichingLiujiaoEngine.interpret(r)
}

const RESIDUE = ['TODO', '待补', '待填', 'undefined', 'null', '[object']

describe('Y3-13 体系不串用', () => {
  beforeAll(() => {
    bootstrapContent()
  })

  it('卦爻辞与旺衰各带独立披露（不互为依据）', () => {
    const b = interp()
    const keys = b.blocks.map((x) => x.key)
    expect(keys).toContain('textCaveat') // 卦爻辞：尚未过权威版本核校
    expect(keys).toContain('wangShuaiCaveat') // 旺衰：量化为暂定口径
    const t1 = b.blocks.find((x) => x.key === 'textCaveat')!.text
    const t2 = b.blocks.find((x) => x.key === 'wangShuaiCaveat')!.text
    expect(t1).not.toBe(t2)
    expect(t1).toContain('卦')
    expect(t2).toContain('旺衰')
  })

  it('装卦已转正（NA_JIA_REVIEWED=true）→ 不再输出「尚未过权威核验」', () => {
    const b = interp()
    expect(b.blocks.map((x) => x.key)).not.toContain('naJiaCaveat')
  })

  it('旺衰 / 判读块不夹带卦爻辞原文（不当断语引用）', () => {
    const b = interp()
    const structural = b.blocks
      .filter((x) => ['wangShuai', 'verdict', 'verdictTemplate'].includes(x.key))
      .map((x) => x.text)
      .join('\n')
    // 卦辞原文不应出现在结构层文案里
    for (const h of hexagramTextItems.slice(0, 10)) {
      if (h.ci && h.ci.length > 4) expect(structural).not.toContain(h.ci)
    }
  })

  it('384 爻白话已清零（无空缺、无占位）', () => {
    expect(lineTextItems).toHaveLength(384)
    const missing = lineTextItems.filter((l) => !l.baiHua || !l.baiHua.trim())
    expect(missing).toHaveLength(0)
  })
})

describe('Y3-13 无未本地化残留', () => {
  beforeAll(() => {
    bootstrapContent()
  })

  it('结果全文无占位 / 未定义残留', () => {
    const b = interp()
    const all = [b.title, b.summary ?? '', ...b.blocks.map((x) => x.text)].join('\n')
    for (const r of RESIDUE) expect(all.includes(r)).toBe(false)
  })
})

describe('Y3-13 母版缺失 → L3 不串味', () => {
  it('卦爻辞块消失，装卦 / 旺衰结构照旧，且不编造卦辞', () => {
    setIchingTextProvider(() => undefined)
    setIchingTemplateProvider(() => [])
    setIchingYiLiProvider(() => undefined)
    const b = interp()
    const keys = b.blocks.map((x) => x.key)
    expect(keys).not.toContain('textCaveat')
    expect(keys).toContain('wangShuai')
    const all = b.blocks.map((x) => x.text).join('\n')
    // L3 兜底只给结构，绝不输出母版卦辞原文（可以提「卦辞」二字，但不能给内容）
    for (const h of hexagramTextItems.slice(0, 10)) {
      if (h.ci && h.ci.length > 4) expect(all).not.toContain(h.ci)
    }
  })
})
