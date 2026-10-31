import { describe, it, expect, afterEach } from 'vitest'
import { hexagramByIndex, TRIGRAM_BY_NAME } from '@/engine/iching/constants'
import { setIchingTextProvider, ichingMeihuaEngine } from '@/engine/iching'
import { getHexagramText, getYongText, lineTextItems, yongItems } from '@/data/content/iching'
import { createRandomSource } from '@/engine/random'

/**
 * 三百八十四爻母版（Y3-02）
 *
 * 数据来源：**采集**（github.com/freizl/yijing，MIT），不是手写 —— 与签文采集同一条路子。
 * 本文件的重点仍是交叉校验：爻位 / 阴阳 / 卦名 / 卦序必须与引擎卦象逐条对上。
 * ⚠️ 白话（baiHua）384 条**尚未撰写**，空缺被显式统计，不拿原文冒充白话。
 */
const RNG = createRandomSource('fixed')

afterEach(() => setIchingTextProvider(null))

function engineLines(index: number): boolean[] {
  const h = hexagramByIndex(index)
  return [...TRIGRAM_BY_NAME[h.lower].lines, ...TRIGRAM_BY_NAME[h.upper].lines]
}

describe('爻辞母版结构', () => {
  it('384 条：六十四卦 × 六爻，每卦爻位 1–6 齐全', () => {
    expect(lineTextItems).toHaveLength(384)
    for (let hex = 1; hex <= 64; hex++) {
      const six = lineTextItems.filter((l) => l.index === hex).sort((a, b) => a.position - b.position)
      expect(six, `第 ${hex} 卦`).toHaveLength(6)
      expect(six.map((l) => l.position)).toEqual([1, 2, 3, 4, 5, 6])
    }
  })

  it('卦名与卦序和引擎卦表逐条一致', () => {
    for (const l of lineTextItems) {
      expect(hexagramByIndex(l.index).name).toBeDefined()
      const hex = hexagramByIndex(l.index)
      const sameHex = lineTextItems.filter((x) => x.index === l.index)
      for (const s of sameHex) expect(s.name).toBe(hex.name)
    }
  })

  it('爻之阴阳与卦象逐条一致（以卦象为准）', () => {
    for (const l of lineTextItems) {
      expect(engineLines(l.index)[l.position - 1], `${l.name} 第 ${l.position} 爻`).toBe(l.yang)
    }
  })

  it('源数据缺陷被标记且可见：爻题与卦象冲突 1 条（大有六二）', () => {
    const conflicts = lineTextItems.filter((l) => l.conflict)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].index).toBe(14)
    expect(conflicts[0].position).toBe(2)
    console.log(`[Y3-02] 爻题冲突：${conflicts[0].name} ${conflicts[0].yaoTitle}（待权威底本核定）`)
  })

  it('源数据缺陷被标记且可见：疑似抄串的重复爻辞 2 条（同人六二 / 大有六二）', () => {
    const dups = lineTextItems.filter((l) => l.dupSuspected)
    expect(dups).toHaveLength(2)
    expect(dups.map((d) => `${d.index}·${d.position}`).sort()).toEqual(['13·2', '14·2'])
    console.log('[Y3-02] 疑似重复：同人六二与大有六二爻辞相同（待权威底本核定）')
  })

  it('爻辞非空（384 条全部有值）', () => {
    for (const l of lineTextItems) {
      expect(l.ci?.length ?? 0, `${l.name} ${l.yaoTitle}`).toBeGreaterThan(0)
    }
  })

  it('用九 / 用六 单列，不计入 384 爻', () => {
    expect(yongItems).toHaveLength(2)
    expect(yongItems.map((y) => y.name)).toEqual(['乾', '坤'])
    expect(getYongText(1)?.yaoTitle).toBe('用九')
    expect(getYongText(2)?.yaoTitle).toBe('用六')
  })

  it('白话空缺被显式统计（不拿原文冒充白话）', () => {
    const filled = lineTextItems.filter((l) => l.baiHua && l.baiHua.trim() !== '')
    const missing = lineTextItems.filter((l) => !l.baiHua || l.baiHua.trim() === '')
    // 构成守恒：已撰写 + 空缺 = 384（内容侧按卦分批推进，此断言不随批次变化而失效）
    expect(filled.length + missing.length).toBe(384)
    // 已撰写的白话不得与爻辞原文雷同（不拿原文冒充白话）
    for (const l of filled) {
      expect(String(l.baiHua ?? '').trim(), `${l.name} ${l.yaoTitle}`).not.toBe(l.ci.trim())
    }
    console.log(`[Y3-02] 白话已撰写 ${filled.length} / 384，空缺 ${missing.length}（内容侧按卦分批推进）`)
  })

  it('乾卦六爻锚点', () => {
    const qian = lineTextItems.filter((l) => l.index === 1).sort((a, b) => a.position - b.position)
    expect(qian[0].yaoTitle).toBe('初九')
    expect(qian[0].ci).toContain('潜龙')
    expect(qian[4].yaoTitle).toBe('九五')
    expect(qian[4].ci).toContain('飞龙在天')
  })
})

describe('引擎集成', () => {
  it('动爻显示爻辞（乾卦数字起卦 1/1 → 动爻 2 → 见龙在田）', () => {
    setIchingTextProvider(getHexagramText)
    const r = ichingMeihuaEngine.compute({ type: 'number', a: 1, b: 1 }, RNG)
    const it = ichingMeihuaEngine.interpret(r)
    expect(r.cast.benGua.name).toBe('乾')
    expect(r.cast.dongYao).toEqual([2])
    const yaoBlock = it.blocks.find((b) => b.key === 'yaoCi-2')
    expect(yaoBlock).toBeDefined()
    expect(yaoBlock!.text).toContain('见龙在田')
  })

  it('母版缺爻辞时不编造（不出现爻辞块）', () => {
    setIchingTextProvider((i) => {
      const e = getHexagramText(i)
      return e ? { ...e, yaoCi: undefined } : undefined
    })
    const r = ichingMeihuaEngine.compute({ type: 'number', a: 1, b: 1 }, RNG)
    const it = ichingMeihuaEngine.interpret(r)
    expect(it.blocks.map((b) => b.key)).not.toContain('yaoCi-2')
  })
})
