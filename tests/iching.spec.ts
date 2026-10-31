import { describe, it, expect, afterEach } from 'vitest'
import {
  HEXAGRAMS,
  TRIGRAMS,
  TRIGRAM_BY_NAME,
  hexagramByIndex,
  hexagramByLines,
  hexagramByTrigrams,
  trigramByLines,
  trigramByNumber,
  wuXingRelation
} from '@/engine/iching/constants'
import {
  castByCoins,
  castByNumbers,
  castByText,
  castByTime,
  hourToZhiIndex,
  mod6,
  mod8,
  tossThreeCoins
} from '@/engine/iching/cast'
import { huGuaOf, meiHua, tiYongRelation } from '@/engine/iching/meiHua'
import {
  ichingLiujiaoEngine,
  ichingMeihuaEngine,
  setIchingTextProvider,
  type IchingTextEntry
} from '@/engine/iching'
import { createRandomSource } from '@/engine/random'
import { getEngine, requireEngine } from '@/engine/registry'

/**
 * 卜筮：起卦（Y3-03）与梅花体用互变（Y3-08）
 *
 * 本轮只覆盖**确定性算法**（不依赖 golden）：
 * - 卦表结构与爻序；
 * - 四种起卦法的可复现性与**余数为 0 的边界**（JY-05 §3 明确要求）；
 * - 体用 / 互卦 / 变卦 / 五行生克。
 * 卦爻辞与断语属内容母版（Y3-01/02/09），未装载时必须走 L3 兜底，**不得编造**。
 */
afterEach(() => setIchingTextProvider(null))

/** 确定性起卦不需要随机源，但引擎签名要求注入（保持单一注入口） */
const RNG = createRandomSource('fixed')

describe('卦表常量', () => {
  it('八卦：先天数与爻象一一对应', () => {
    expect(TRIGRAMS).toHaveLength(8)
    for (const t of TRIGRAMS) {
      expect(trigramByNumber(t.number).name).toBe(t.name)
      expect(trigramByLines(t.lines).name).toBe(t.name)
    }
    // 乾三连、坤六断
    expect(TRIGRAM_BY_NAME['乾'].lines).toEqual([true, true, true])
    expect(TRIGRAM_BY_NAME['坤'].lines).toEqual([false, false, false])
    // 离中虚、坎中满
    expect(TRIGRAM_BY_NAME['离'].lines).toEqual([true, false, true])
    expect(TRIGRAM_BY_NAME['坎'].lines).toEqual([false, true, false])
  })

  it('六十四卦：64 条、序号与上下卦组合均唯一', () => {
    expect(HEXAGRAMS).toHaveLength(64)
    expect(new Set(HEXAGRAMS.map((h) => h.index)).size).toBe(64)
    expect(new Set(HEXAGRAMS.map((h) => `${h.upper}/${h.lower}`)).size).toBe(64)
    expect(new Set(HEXAGRAMS.map((h) => h.name)).size).toBe(64)
  })

  it('六爻 ↔ 上下卦 ↔ 卦名 三者一致', () => {
    for (const h of HEXAGRAMS) {
      const lines = [
        ...TRIGRAM_BY_NAME[h.lower].lines,
        ...TRIGRAM_BY_NAME[h.upper].lines
      ] as boolean[]
      expect(hexagramByLines(lines).index).toBe(h.index)
      expect(hexagramByTrigrams(h.upper, h.lower).index).toBe(h.index)
    }
  })

  it('卦序锚点：乾 1 / 坤 2 / 既济 63 / 未济 64', () => {
    expect(hexagramByIndex(1).name).toBe('乾')
    expect(hexagramByIndex(2).name).toBe('坤')
    expect(hexagramByIndex(63).name).toBe('既济')
    expect(hexagramByIndex(64).name).toBe('未济')
  })

  it('上下卦 ↔ 俗称锚点（防上下卦写反：火雷噬嗑 / 雷火丰 是经典易错对）', () => {
    expect(hexagramByTrigrams('乾', '坤').name).toBe('否') // 天地否
    expect(hexagramByTrigrams('坤', '乾').name).toBe('泰') // 地天泰
    expect(hexagramByTrigrams('离', '震').name).toBe('噬嗑') // 火雷噬嗑
    expect(hexagramByTrigrams('震', '离').name).toBe('丰') // 雷火丰
    expect(hexagramByTrigrams('坎', '离').name).toBe('既济') // 水火既济
    expect(hexagramByTrigrams('离', '坎').name).toBe('未济') // 火水未济
  })

  it('五行生克：五类齐全（含被生 / 被克，只判单向会算错体用）', () => {
    expect(wuXingRelation('木', '火')).toBe('生') // 木生火
    expect(wuXingRelation('水', '火')).toBe('克') // 水克火
    expect(wuXingRelation('火', '木')).toBe('被生') // 火被木生
    expect(wuXingRelation('火', '水')).toBe('被克') // 火被水克
    expect(wuXingRelation('金', '金')).toBe('同')
  })
})

describe('起卦（Y3-03）', () => {
  it('取模边界：余数为 0 时取 8 / 6（不是 0）', () => {
    expect(mod8(8)).toBe(8)
    expect(mod8(16)).toBe(8)
    expect(mod8(1)).toBe(1)
    expect(mod6(6)).toBe(6)
    expect(mod6(12)).toBe(6)
    expect(mod6(4)).toBe(4)
  })

  it('铜钱：三枚之和只能是 6 / 7 / 8 / 9', () => {
    const rng = createRandomSource('coins')
    const seen = new Set<number>()
    for (let i = 0; i < 200; i++) seen.add(tossThreeCoins(rng))
    expect([...seen].sort()).toEqual([6, 7, 8, 9])
  })

  it('铜钱起卦：六爻，固定种子可复现，动爻必为 6 / 9', () => {
    const a = castByCoins(createRandomSource('seed-A'))
    const b = castByCoins(createRandomSource('seed-A'))
    expect(a.lines).toEqual(b.lines)
    expect(a.yao).toHaveLength(6)
    for (const y of a.yao) {
      expect([6, 7, 8, 9]).toContain(y.value)
      // 奇偶定阴阳：7/9 阳，6/8 阴；只有 6/9 动
      expect(y.yang).toBe(y.value === 7 || y.value === 9)
      expect(y.moving).toBe(y.value === 6 || y.value === 9)
    }
    for (const n of a.dongYao) expect([6, 7, 8, 9]).toContain(a.yao[n - 1].value)
  })

  it('铜钱起卦：动爻与本卦 / 变卦自洽', () => {
    const r = castByCoins(createRandomSource('seed-B'))
    if (r.dongYao.length === 0) {
      expect(r.bianGua).toBeUndefined()
    } else {
      expect(r.bianGua).toBeDefined()
      // 变卦只在动爻位取反
      r.lines.forEach((l, i) => {
        const expectLine = r.dongYao.includes(i + 1) ? !l : l
        expect(r.bianLines![i]).toBe(expectLine)
      })
    }
  })

  it('数字起卦：先天数映射正确（1/1 → 乾，8/8 → 坤）', () => {
    expect(castByNumbers(1, 1).benGua.index).toBe(1)
    expect(castByNumbers(8, 8).benGua.index).toBe(2)
    expect(castByNumbers(1, 1).dongYao).toEqual([2])
    expect(castByNumbers(8, 8).dongYao).toEqual([4]) // (8+8)%6 = 4
  })

  it('字数起卦：分段与动爻（JY-08：动爻计入时辰支）', () => {
    // 2 字 → 前 1 后 1 → 乾 / 乾；午时(支序 7)：(2+7)=9 → 9%6=3 → 九三
    const r = castByText('稽疑', 12)
    expect(r.benGua.index).toBe(1)
    expect(r.dongYao).toEqual([3])
    expect(r.basis['时辰支序']).toBe(7)
    const r8 = castByText('一二三四五六七八', 12) // 8 字 → 前 4 后 4 → 震/震
    expect(r8.basis['前段']).toBe(4)
    expect(r8.dongYao).toEqual([3]) // (8+7)=15 → 15%6=3
    // 时辰缺失 / 非法 → 抛错，不静默用纯字数口径（YR2）
    expect(() => castByText('稽疑', Number.NaN)).toThrow()
    expect(() => castByText('稽疑', 24)).toThrow()
  })

  it('时间起卦：可复现，且用农历年支与时辰支', () => {
    const input = { year: 2026, month: 9, day: 16, hour: 14 }
    const r = castByTime(input)
    const r2 = castByTime(input)
    expect(r.lines).toEqual(r2.lines)
    expect(r.basis['农历年']).toBeTruthy()
    expect(typeof r.basis['年支序']).toBe('number')
    expect(hourToZhiIndex(23)).toBe(1)
    expect(hourToZhiIndex(0)).toBe(1)
    expect(hourToZhiIndex(13)).toBe(8) // 未时（13–15）
  })

  it('非法输入抛错（不静默给值）', () => {
    expect(() => castByNumbers(Number.NaN, 1)).toThrow()
    expect(() => castByText('   ', 12)).toThrow()
    expect(() => hourToZhiIndex(24)).toThrow()
  })
})

describe('梅花体用互变（Y3-08）', () => {
  it('互卦：取 2/3/4 与 3/4/5 爻', () => {
    // 乾为天（全阳）→ 互卦仍是乾
    expect(huGuaOf([true, true, true, true, true, true]).index).toBe(1)
    // 坤为地（全阴）→ 互卦仍是坤
    expect(huGuaOf([false, false, false, false, false, false]).index).toBe(2)
  })

  it('体用：动爻在下卦 → 下为用、上为体', () => {
    const cast = castByNumbers(1, 1) // 乾 / 乾，动爻 2（在下卦）
    const m = meiHua(cast)
    expect(m.dongYao).toEqual([2])
    expect(m.yong.trigram).toBe(cast.benGua.lower)
    expect(m.ti.trigram).toBe(cast.benGua.upper)
  })

  it('体用：动爻在上卦 → 上为用、下为体', () => {
    const m = meiHua(castByNumbers(1, 8)) // 上乾下坤，(1+8)%6 = 3 → 动爻 3 在下卦
    expect(m.dongYao).toEqual([3])
    const m2 = meiHua(castByNumbers(1, 3)) // (1+3)=4 → 动爻 4 在上卦
    expect(m2.dongYao).toEqual([4])
    expect(m2.yong.trigram).toBe(m2.benGua.upper)
    expect(m2.ti.trigram).toBe(m2.benGua.lower)
  })

  it('变卦：动爻阴阳互变', () => {
    const cast = castByNumbers(1, 1)
    const m = meiHua(cast)
    expect(m.bianGua).toBeDefined()
    expect(m.bianGua!.index).not.toBe(m.benGua.index)
  })

  it('体用关系覆盖五种情形', () => {
    expect(tiYongRelation('木', '水')).toBe('用生体')
    expect(tiYongRelation('木', '木')).toBe('比和')
    expect(tiYongRelation('土', '水')).toBe('体克用') // 土克水
    expect(tiYongRelation('木', '火')).toBe('体生用') // 木生火
    expect(tiYongRelation('火', '水')).toBe('用克体') // 水克火
    expect(tiYongRelation('土', '木')).toBe('用克体') // 木克土
  })
})

describe('卜筮引擎注册与 L3 兜底', () => {
  it('两个子玩法均已注册且可按 kind+method 取到', () => {
    expect(getEngine('iching', 'liujiao')).toBeDefined()
    expect(getEngine('iching', 'meihua')).toBeDefined()
    expect(() => requireEngine('iching', 'nope')).toThrow()
  })

  it('铜钱引擎：固定种子可复现，输出本卦 + 动爻', () => {
    const r1 = ichingLiujiaoEngine.compute({}, createRandomSource('fixed'))
    const r2 = ichingLiujiaoEngine.compute({}, createRandomSource('fixed'))
    expect(r1.cast.benGua.index).toBe(r2.cast.benGua.index)
    expect(r1.cast.dongYao).toEqual(r2.cast.dongYao)
  })

  it('母版未装载 → L3 兜底：给结构，不编造卦爻辞', () => {
    const r = ichingMeihuaEngine.compute({ type: 'number', a: 1, b: 1 }, RNG)
    const it = ichingMeihuaEngine.interpret(r)
    expect(it.degraded).toContain('hexagram-text')
    expect(it.title).toContain('乾')
    const keys = it.blocks.map((b) => b.key)
    expect(keys).toContain('benGua')
    expect(keys).toContain('dongYao')
    expect(keys).toContain('huGua')
    expect(keys).toContain('tiYong')
    expect(keys).not.toContain('ci')
    expect(it.blocks.every((b) => b.level === 'l3')).toBe(true)
  })

  it('母版注入后自动升级为 L1（卦辞 + 动爻爻辞）', () => {
    const entry: IchingTextEntry = {
      index: 1,
      name: '乾',
      ci: '元亨利贞',
      yaoCi: ['潜龙勿用', '见龙在田', '君子终日乾乾', '或跃在渊', '飞龙在天', '亢龙有悔'],
      source: { name: '《周易》王弼注系统', license: '公有领域' }
    }
    setIchingTextProvider((i) => (i === 1 ? entry : undefined))
    const r = ichingMeihuaEngine.compute({ type: 'number', a: 1, b: 1 }, RNG)
    const it = ichingMeihuaEngine.interpret(r)
    expect(it.degraded).toBeUndefined()
    expect(it.blocks.find((b) => b.key === 'ci')?.text).toBe('元亨利贞')
    // 动爻为 2 → 应带上「见龙在田」
    expect(it.blocks.some((b) => b.text === '见龙在田')).toBe(true)
    expect(it.source).toContain('《周易》')
  })

  it('梅花引擎三种起卦入口均可用', () => {
    expect(ichingMeihuaEngine.compute({ type: 'number', a: 3, b: 5 }, RNG).cast.method).toBe(
      'number'
    )
    expect(
      ichingMeihuaEngine.compute({ type: 'text', text: '稽疑', hour: 12 }, RNG).cast.method
    ).toBe('text')
    expect(
      ichingMeihuaEngine.compute(
        { type: 'time', year: 2026, month: 9, day: 16, hour: 10 },
        RNG
      ).cast.method
    ).toBe('time')
    expect(() => ichingMeihuaEngine.compute({ type: 'number', a: 1 }, RNG)).toThrow()
    expect(() => ichingMeihuaEngine.compute({ type: 'time' }, RNG)).toThrow()
  })
})
