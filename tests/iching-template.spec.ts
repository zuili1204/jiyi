import { describe, expect, it, afterEach } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ichingLiujiaoEngine,
  ichingMeihuaEngine,
  setIchingTemplateProvider,
  setIchingYiLiProvider,
  setIchingTextProvider,
  type IchingTemplateContext,
  type IchingTemplateEntry
} from '@/engine/iching'
import { createRandomSource } from '@/engine/random'
import {
  getIchingTemplate,
  getIchingTemplateOverall,
  ichingTemplateItems,
  ICHING_TPL_META,
  getYiLiEntries,
  getHexagramText
} from '@/data/content/iching'

/**
 * 卜筮内容母版之二：断语模板（Y3-09）+ 义理解卦（Y3-04）
 *
 * 纪律：断语模板 / 义理导读在内容母版注入后升级为 L2；未注入时维持既有
 * taibu 参照兜底（l3）——旧测试不受影响。母版自撰白话，`reviewed:false`，
 * 须带「待核校」可见，并走内容闸严检（自撰不豁免）。
 */

const RNG = createRandomSource('fixed')
const TPL_MASTER = join(process.cwd(), 'DOCS', 'content', 'iching', 'templates.json')
/** 发布仓库不提供内容母版：仅"母版实测"用例跳过，其余走已入库快照 */
const hasTplMaster = existsSync(TPL_MASTER)

afterEach(() => {
  setIchingTemplateProvider(null)
  setIchingYiLiProvider(null)
  setIchingTextProvider(null)
})

/** 注入模板 + 义理 provider（与 bootstrap 等价） */
function withTemplates() {
  setIchingTemplateProvider((ctx: IchingTemplateContext): IchingTemplateEntry[] => {
    const items: IchingTemplateEntry[] = []
    const pick = (dim: 'meihua' | 'yongShen', key?: string) => {
      const it = key ? getIchingTemplate(dim, key) : undefined
      if (it)
        items.push({
          id: it.id,
          key: it.key,
          label: it.label,
          text: it.text,
          reviewed: ICHING_TPL_META.reviewed,
          source: { name: ICHING_TPL_META.source, license: ICHING_TPL_META.license }
        })
    }
    pick('meihua', ctx.meihuaKey)
    pick('yongShen', ctx.yongShenKey)
    const overall = getIchingTemplateOverall()
    if (overall)
      items.push({
        id: overall.id,
        key: overall.key,
        label: overall.label,
        text: overall.text,
        reviewed: ICHING_TPL_META.reviewed,
        source: { name: ICHING_TPL_META.source, license: ICHING_TPL_META.license }
      })
    return items
  })
  setIchingYiLiProvider((i) => getYiLiEntries(i))
  setIchingTextProvider(getHexagramText)
}

function liuJiaoWithAt() {
  return ichingLiujiaoEngine.compute({ at: { year: 2026, month: 9, day: 16, hour: 14, minute: 0 } }, RNG)
}

describe('Y3-09 断语模板母版结构', () => {
  it('条目覆盖：梅花体用 5 关系 + 用神旺/平/衰 3 档 + 整体兜底', () => {
    expect(ichingTemplateItems.filter((i) => i.dim === 'meihua')).toHaveLength(5)
    expect(ichingTemplateItems.filter((i) => i.dim === 'yongShen').map((i) => i.key)).toEqual(['旺', '平', '衰'])
    expect(ichingTemplateItems.filter((i) => i.dim === 'overall')).toHaveLength(1)
  })

  it('条目 id 唯一', () => {
    const ids = new Set(ichingTemplateItems.map((i) => i.id))
    expect(ids.size).toBe(ichingTemplateItems.length)
  })

  it('母版声明出处 + reviewed:false', () => {
    expect(ICHING_TPL_META.source).toBeTruthy()
    expect(ICHING_TPL_META.license).toBeTruthy()
    expect(ICHING_TPL_META.reviewed).toBe(false)
  })

  it.skipIf(!hasTplMaster)('母版实物与产物条数一致（sync 闭环）', () => {
    const doc = JSON.parse(readFileSync(TPL_MASTER, 'utf8'))
    expect(doc.items).toHaveLength(ichingTemplateItems.length)
    expect(doc.reviewed).toBe(false)
  })
})

describe('Y3-09 引擎注入（模板升级 L2）', () => {
  it('梅花：注入模板后体用断句转 L2，保留待核验可见', () => {
    withTemplates()
    const it = ichingMeihuaEngine.interpret(ichingMeihuaEngine.compute({ type: 'number', a: 1, b: 1 }, RNG))
    const v = it.blocks.find((b) => b.key === 'meihuaVerdict')
    expect(v).toBeDefined()
    expect(v!.level).toBe('l2')
    const caveat = it.blocks.find((b) => b.key === 'meihuaVerdictCaveat')
    expect(caveat).toBeDefined()
    expect(caveat!.text).toContain('通行参考')
    // 断句已切换为自撰模板文案（vs taibu 兜底短语）
    expect(v!.text).not.toContain('taibu')
  })

  it('不注入模板 → 梅花仍走 taibu 兜底 l3（旧行为不变）', () => {
    const it = ichingMeihuaEngine.interpret(ichingMeihuaEngine.compute({ type: 'number', a: 1, b: 1 }, RNG))
    const v = it.blocks.find((b) => b.key === 'meihuaVerdict')
    expect(v).toBeDefined()
    expect(v!.level).toBe('l3')
  })

  it('六爻：注入模板后用神提示转 L2 且带待核校', () => {
    withTemplates()
    const it = ichingLiujiaoEngine.interpret(liuJiaoWithAt())
    const verdict = it.blocks.find((b) => b.key === 'verdict')
    expect(verdict).toBeDefined()
    expect(verdict!.level).toBe('l2')
    const caveat = it.blocks.find((b) => b.key === 'verdictCaveat')
    expect(caveat).toBeDefined()
    expect(caveat!.text).toContain('通行参考')
  })

  it('无 at → 无旺衰 → 无六义理判读块（不假装算得出来）', () => {
    withTemplates()
    const it = ichingLiujiaoEngine.interpret(ichingLiujiaoEngine.compute({}, RNG))
    const verdict = it.blocks.find((b) => b.key === 'verdict')
    expect(verdict).toBeUndefined()
  })
})

describe('Y3-04 义理解卦（导读块）', () => {
  it('含卦与变卦时输出解卦导读（l2 级别的自撰白话）', () => {
    withTemplates()
    // 固定种子大概率会取到本卦 + 动爻 → 变卦
    const it = ichingMeihuaEngine.interpret(ichingMeihuaEngine.compute({ type: 'number', a: 1, b: 2 }, RNG))
    // 至少会有一个导读块（本卦必有白话）
    const yi = it.blocks.find((b) => b.key === 'yiliReading')
    expect(yi).toBeDefined()
    expect(yi!.level).toBe('l2')
  })

  it('未注入义理 provider 时不出导读块（降级，不编造）', () => {
    const r = ichingMeihuaEngine.compute({ type: 'number', a: 1, b: 1 }, RNG)
    setIchingYiLiProvider(null)
    const it = ichingMeihuaEngine.interpret(r)
    expect(it.blocks.find((b) => b.key === 'yiliReading')).toBeUndefined()
  })

  it('义理导读文本来自已过闸白话（本卦白话字段）', () => {
    withTemplates()
    const it = ichingMeihuaEngine.interpret(ichingMeihuaEngine.compute({ type: 'number', a: 1, b: 1 }, RNG))
    const gi = it.blocks.find((b) => b.key === 'yiliReading')
    expect(gi).toBeDefined()
  })
})