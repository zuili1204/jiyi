import { describe, it, expect, afterEach } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HEXAGRAMS, hexagramByIndex } from '@/engine/iching/constants'
import { gongOf } from '@/engine/iching/naJia'
import { setIchingTextProvider, ichingMeihuaEngine } from '@/engine/iching'
import { getHexagramText, hexagramTextItems, HEXAGRAM_TEXT_META } from '@/data/content/iching'
import { scanJson, hasBlock } from '@/engine/compliance'
import { createRandomSource } from '@/engine/random'

/**
 * 六十四卦母版（Y3-01）
 *
 * 录入型数据最容易「错得静悄悄」，所以本文件的重点是**交叉校验**：
 * 母版里的卦名 / 卦序 / 上下卦 / 八宫 / 卦宫五行，必须与引擎卦表、八宫表逐条对上。
 * ⚠️ 母版 `reviewed = false`：卦辞与象传**尚未过权威版本核校**，不得作为 golden 期望值来源。
 */
const MASTER = join(process.cwd(), 'DOCS', 'content', 'iching', 'hexagrams.json')
/** 发布仓库不提供内容母版：仅"母版实测"用例跳过，其余走已入库快照 */
const hasMaster = existsSync(MASTER)

afterEach(() => setIchingTextProvider(null))

/** 梅花起卦是确定性的，但引擎签名要求注入随机源 */
const RNG = createRandomSource('fixed')

describe('母版结构', () => {
  it('64 条，卦序 1–64 唯一且与引擎卦表逐条一致', () => {
    expect(hexagramTextItems).toHaveLength(64)
    const ids = new Set(hexagramTextItems.map((i) => i.index))
    expect(ids.size).toBe(64)
    for (const item of hexagramTextItems) {
      const h = hexagramByIndex(item.index)
      expect(item.name, `卦序 ${item.index}`).toBe(h.name)
      expect(item.upper).toBe(h.upper)
      expect(item.lower).toBe(h.lower)
    }
  })

  it('八宫与卦宫五行与引擎八宫表一致（防数据漂移）', () => {
    const bad: string[] = []
    for (const item of hexagramTextItems) {
      const g = gongOf(item.name)
      if (item.gong !== g.gong.name || item.gongWuXing !== g.gong.element) {
        bad.push(
          `${item.index} ${item.name}：母版 ${item.gong}/${item.gongWuXing} ≠ 引擎 ${g.gong.name}/${g.gong.element}`
        )
      }
    }
    if (bad.length) console.log('[八宫不一致]\n' + bad.join('\n'))
    for (const item of hexagramTextItems) {
      const g = gongOf(item.name)
      expect(item.gong, `${item.name} 宫`).toBe(g.gong.name)
      expect(item.gongWuXing, `${item.name} 宫五行`).toBe(g.gong.element)
    }
  })

  it('卦辞 / 象传 / 白话 三类文本均无空缺', () => {
    for (const it of hexagramTextItems) {
      expect(it.ci?.length ?? 0, `${it.name} 缺卦辞`).toBeGreaterThan(0)
      expect(it.daXiang?.length ?? 0, `${it.name} 缺象传`).toBeGreaterThan(0)
      expect(it.baiHua?.length ?? 0, `${it.name} 缺白话`).toBeGreaterThan(0)
    }
  })

  it('母版声明了出处与许可，且未核验状态可见', () => {
    expect(HEXAGRAM_TEXT_META.source).toBeTruthy()
    expect(HEXAGRAM_TEXT_META.license).toBeTruthy()
    expect(HEXAGRAM_TEXT_META.school).toBeTruthy()
    expect(HEXAGRAM_TEXT_META.reviewed).toBe(false)
  })

  it.skipIf(!hasMaster)('母版文件实物与产物条目数一致（sync 闭环）', () => {
    const doc = JSON.parse(readFileSync(MASTER, 'utf8'))
    expect(doc.items).toHaveLength(64)
    expect(doc.originalFields).toEqual(['ci', 'daXiang'])
    expect(doc.reviewed).toBe(false)
  })
})

describe('内容闸：原文豁免 / 白话严检', () => {
  it('卦辞与象传（古籍原文）走豁免，不 block', () => {
    const doc = {
      items: hexagramTextItems.map((i) => ({ ci: i.ci, daXiang: i.daXiang }))
    }
    expect(hasBlock(scanJson(doc, 'iching'))).toBe(false)
  })

  it('白话（自撰译注）不在豁免范围：含违规词照样 block', () => {
    const ok = { items: hexagramTextItems.map((i) => ({ baiHua: i.baiHua })) }
    expect(hasBlock(scanJson(ok, 'iching'))).toBe(false)
    // 反向验证：给白话塞一个医疗类 block 词，必须被拦下
    const bad = { items: [{ baiHua: '此卦主痊愈之兆' }] }
    const hits = scanJson(bad, 'iching')
    expect(hasBlock(hits)).toBe(true)
    expect(hits.some((h) => h.family === 'medical')).toBe(true)
  })
})

describe('引擎注入', () => {
  it('母版装载后结果升级为 L1：含卦辞与象传', () => {
    setIchingTextProvider(getHexagramText)
    // 数字起卦 1/1 → 乾
    const r = ichingMeihuaEngine.compute({ type: 'number', a: 1, b: 1 }, RNG)
    const it = ichingMeihuaEngine.interpret(r)
    expect(it.degraded).toBeUndefined()
    expect(it.blocks.find((b) => b.key === 'ci')?.text).toBe('元亨利贞')
    expect(it.blocks.find((b) => b.key === 'daXiang')?.text).toContain('自强不息')
  })

  it('未过核校时必须带可见提示（不得宣称权威）', () => {
    setIchingTextProvider(getHexagramText)
    const r = ichingMeihuaEngine.compute({ type: 'number', a: 1, b: 1 }, RNG)
    const it = ichingMeihuaEngine.interpret(r)
    const caveat = it.blocks.find((b) => b.key === 'textCaveat')
    expect(caveat).toBeDefined()
    expect(caveat!.text).toContain('尚未过权威版本核校')
  })

  it('母版缺某一卦时回落到 L3（不编造）', () => {
    setIchingTextProvider((i) => (i === 1 ? undefined : getHexagramText(i)))
    const r = ichingMeihuaEngine.compute({ type: 'number', a: 1, b: 1 }, RNG)
    const it = ichingMeihuaEngine.interpret(r)
    expect(it.degraded).toContain('hexagram-text')
    expect(it.blocks.map((b) => b.key)).not.toContain('ci')
  })

  it('卦名与 HEXAGRAMS 数量对得上（无多无少）', () => {
    expect(HEXAGRAMS).toHaveLength(hexagramTextItems.length)
  })
})
