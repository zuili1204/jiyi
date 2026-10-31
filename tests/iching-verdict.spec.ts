import { describe, expect, it } from 'vitest'
import { ichingLiujiaoEngine, ichingMeihuaEngine, TAIBU_REF_SOURCE } from '@/engine/iching'
import { createRandomSource } from '@/engine/random'

/**
 * 六爻判读（Y3-10 初版断语参照层）
 *
 * 回归锁定四件事：
 * 1. 判读只引 taibu 判读词（旺/衰/平 + 暗动/日破/月破/旬空/动 + 世应强度词），不凭空造词；
 * 2. `reviewed:false` 必须维持（未过 golden），结果页要能体现「待核验」；
 * 3. 判读块断语必须**引用独立计算源**（波3：TAIBU_REF_SOURCE），使「待核验」有凭据；
 * 4. 没有问占时刻 `at` → 没有旺衰 → 不出判读块（不假装算得出来）。
 */

const RNG = createRandomSource('fixed')

function liuJiaoWithAt() {
  return ichingLiujiaoEngine.compute(
    { at: { year: 2026, month: 9, day: 16, hour: 14, minute: 0 } },
    RNG
  )
}

describe('六爻判读参照层 Y3-10', () => {
  it('有 at → najia / wangshuai 齐备 → 出 verdict 参考块（l3 + 待核验说明）', () => {
    const r = liuJiaoWithAt()
    expect(r.najia).toBeDefined()
    expect(r.wangshuai).toBeDefined()

    const it = ichingLiujiaoEngine.interpret(r)
    const v = it.blocks.find((b) => b.key === 'verdict')
    expect(v).toBeDefined()
    expect(v!.level).toBe('l3')
    // 判读是参考，必须带「待核验」说明块
    const caveat = it.blocks.find((b) => b.key === 'verdictCaveat')
    expect(caveat).toBeDefined()
    // 波3：说明块仍声明待核验（判读与独立计算源对照，不宣称权威）
    expect(caveat!.text).toContain('待核验')
    expect(caveat!.text).toContain('仅作参考')
    // 不污染排盘结构块：旺衰块仍在且不带断语
    expect(it.blocks.some((b) => b.key === 'wangShuai')).toBe(true)
  })

  it('梅花：体用关系 → 吉凶判句参照块（taibu 原句、l3 + 待核验）', () => {
    const r = ichingMeihuaEngine.compute({ type: 'number', a: 1, b: 1 }, RNG)
    const it = ichingMeihuaEngine.interpret(r)
    const v = it.blocks.find((b) => b.key === 'meihuaVerdict')
    expect(v).toBeDefined()
    expect(v!.level).toBe('l3')
    const m = it.basis?.meihua as { relation?: string } | undefined
    expect(m?.relation).toBeTruthy()
    const caveat = it.blocks.find((b) => b.key === 'meihuaVerdictCaveat')
    expect(caveat).toBeDefined()
    // 波3：梅花断语说明块保留「通行判例」表述并引用独立计算源常量
    expect(caveat!.text).toContain('通行判例')
    expect(TAIBU_REF_SOURCE).toContain('taibu-core@3.5.0')
  })

  it('无 at → 无旺衰 → 无判读块（不假装算得出来）', () => {
    const r = ichingLiujiaoEngine.compute({}, RNG)
    expect(r.wangshuai).toBeUndefined()
    const it = ichingLiujiaoEngine.interpret(r)
    expect(it.blocks.find((b) => b.key === 'verdict')).toBeUndefined()
  })
})