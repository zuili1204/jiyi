import { describe, expect, it } from 'vitest'
import { computeShenSha } from '@/engine/bazi/relations'
import { ganZhiFromText, type FourPillars } from '@/engine/calendar'

/**
 * 八字神煞（Y4-08）扩展回归：新增神煞表以 taibu-master `packages/core/src/data/shensha.ts`
 * （MIT）为参照。本 spec 用手工四柱断言各新增神煞落宫与落枝，锁定表值与取值方向不回归。
 */

/** 四柱一律走 `ganZhiFromText` 构造器（勿手写裸干支对象，缺 index/text 会类型报错） */
const gz = ganZhiFromText

/** 甲子年 / 丁卯月 / 甲午日 / 壬申时：四柱地支 = 子 · 卯 · 午 · 申 */
const p: FourPillars = {
  year: gz('甲子'),
  month: gz('丁卯'),
  day: gz('甲午'),
  time: gz('壬申')
}

function names(s: ReturnType<typeof computeShenSha>): string[] {
  return s.map((x) => x.name)
}
function at(s: ReturnType<typeof computeShenSha>, name: string): string[] {
  return s.filter((x) => x.name === name).map((x) => `${x.branch}@${x.pillar}`)
}

describe('computeShenSha 扩展神煞（参照 taibu）', () => {
  const s = computeShenSha(p)

  it('新增羊刃（日干甲→卯）', () => {
    expect(at(s, '羊刃')).toEqual(['卯@月'])
  })

  it('新增太极贵人（日干甲→子、午）', () => {
    expect(at(s, '太极贵人').sort()).toEqual(['子@年', '午@日'].sort())
  })

  it('新增将星（年支子→子，命中子@年）', () => {
    // 申子辰 → 将星在「子」；四柱有年子 ⇒ 将星@子@年
    expect(at(s, '将星')).toEqual(['子@年'])
    // 午年将星在「午」→ 至少命中年支&日支
    const p2: FourPillars = { ...p, year: gz('丙午') }
    const s2 = computeShenSha(p2)
    expect(at(s2, '将星')).toContain('午@年')
  })

  it('劫煞（年支子→巳）按年支取值，仅落地命中支', () => {
    expect(at(s, '劫煞')).toEqual([]) // 子劫煞在巳，无巳
  })

  it('孤辰／寡宿（年支子→寅／戌）', () => {
    expect(at(s, '孤辰')).toEqual([])
    expect(at(s, '寡宿')).toEqual([])
  })

  it('红鸾（年支子→卯，命中卯）、天喜（年支子→酉，无酉）', () => {
    expect(at(s, '红鸾')).toEqual(['卯@月'])
    expect(at(s, '天喜')).toEqual([])
  })

  it('原有禄神/文昌/天乙/桃花/驿马/华盖 不因扩展而丢失', () => {
    const ns = names(s)
    // 甲日禄在寅 → 无寅；申时 正是甲日? 禄神甲→寅；四柱无寅 → 禄神不应出现
    expect(ns).not.toContain('禄神')
    // 天乙 甲→丑、未 → 四柱无 → 不出现
    expect(ns).not.toContain('天乙贵人')
    // 华盖：年子→辰，无辰 →不出现
    expect(ns).not.toContain('华盖')
    // 文昌甲→巳 无 → 不出现
    expect(ns).not.toContain('文昌')
    // 桃花：年支子→酉（子午卯酉），四柱无酉 → 不出现
    expect(at(s, '桃花')).toEqual([])
    // 驿马：年支子→寅 无
    expect(ns).not.toContain('驿马')
  })
})