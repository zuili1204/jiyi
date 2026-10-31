import { describe, it, expect } from 'vitest'
import {
  WANG_SHUAI_REVIEWED,
  wangShuai,
  yueLingState,
  type WangShuaiInput
} from '@/engine/iching/wangShuai'
import { isChong } from '@/engine/iching/naJia'
import { naJia } from '@/engine/iching/naJia'
import { castByNumbers } from '@/engine/iching/cast'
import { ichingLiujiaoEngine } from '@/engine/iching'
import { createRandomSource } from '@/engine/random'

/**
 * 六爻旺衰（Y3-07）
 *
 * 覆盖：月令五态、日辰五用、月破 / 暗动 / 日破 / 旬空，以及「**不给时刻就不算旺衰**」的边界。
 * ⚠️ 量化打分是**暂定口径**（`reviewed: false`），只测分项判定与结构，不把分数当权威。
 */
const qian = () => naJia(castByNumbers(1, 1)) // 乾为天，纳支 子寅辰午申戌

describe('月令五态', () => {
  it('寅月（木）：木旺 / 火相 / 水休 / 金囚 / 土死', () => {
    expect(yueLingState('木', '木')).toBe('旺')
    expect(yueLingState('木', '火')).toBe('相') // 月生爻
    expect(yueLingState('木', '水')).toBe('休') // 爻生月
    expect(yueLingState('木', '金')).toBe('囚') // 爻克月
    expect(yueLingState('木', '土')).toBe('死') // 月克爻
  })
})

describe('六冲', () => {
  it('六冲对成立，非冲对不成立', () => {
    for (const [a, b] of [
      ['子', '午'],
      ['丑', '未'],
      ['寅', '申'],
      ['卯', '酉'],
      ['辰', '戌'],
      ['巳', '亥']
    ]) {
      expect(isChong(a, b)).toBe(true)
      expect(isChong(b, a)).toBe(true)
    }
    expect(isChong('子', '丑')).toBe(false)
    expect(isChong('子', '子')).toBe(false)
  })
})

describe('旺衰判定', () => {
  const input: WangShuaiInput = { yueZhi: '寅', riZhi: '子' }

  it('乾卦（子寅辰午申戌）在寅月子日：六爻月令状态', () => {
    const r = wangShuai(qian(), input)
    expect(r.yao.map((y) => y.yue)).toEqual(['休', '旺', '死', '相', '囚', '死'])
    expect(r.yao.map((y) => y.ri)).toEqual(['同', '生', '耗', '克', '泄', '耗'])
  })

  it('每一爻都带可解释的判定依据（让误差可见）', () => {
    const r = wangShuai(qian(), input)
    for (const y of r.yao) {
      expect(y.reasons.length).toBeGreaterThanOrEqual(2)
      expect(y.reasons[0]).toContain('月令')
      expect(y.reasons[1]).toContain('日辰')
    }
  })

  it('月破：月建冲爻', () => {
    const r = wangShuai(qian(), { yueZhi: '午', riZhi: '寅' }) // 午冲初爻子
    expect(r.yao[0].yuePo).toBe(true)
    expect(r.yao[0].reasons.some((x) => x.includes('月破'))).toBe(true)
    expect(r.yao.filter((y) => y.yuePo)).toHaveLength(1)
  })

  it('日冲：旺相为暗动，休囚死为日破', () => {
    // 初爻子水：亥月（水旺）逢午日冲 → 暗动
    const anDong = wangShuai(qian(), { yueZhi: '亥', riZhi: '午' })
    expect(anDong.yao[0].yue).toBe('旺')
    expect(anDong.yao[0].riChong).toBe('暗动')
    // 午月（水囚）逢午日冲 → 日破
    const riPo = wangShuai(qian(), { yueZhi: '午', riZhi: '午' })
    expect(riPo.yao[0].yue).toBe('囚')
    expect(riPo.yao[0].riChong).toBe('日破')
    // 不冲则为无
    expect(wangShuai(qian(), input).yao[0].riChong).toBe('无')
  })

  it('旬空：命中的爻被标记且扣分', () => {
    const withKong = wangShuai(qian(), { ...input, kongWang: ['子'] })
    const without = wangShuai(qian(), input)
    expect(withKong.yao[0].kongWang).toBe(true)
    expect(without.yao[0].kongWang).toBe(false)
    expect(withKong.yao[0].score).toBe(without.yao[0].score - 2)
  })

  it('综合等级落在旺 / 平 / 衰三档内', () => {
    for (const y of wangShuai(qian(), input).yao) {
      expect(['旺', '平', '衰']).toContain(y.level)
    }
  })

  it('未核验状态可见', () => {
    expect(WANG_SHUAI_REVIEWED).toBe(false)
    expect(wangShuai(qian(), input).reviewed).toBe(false)
  })
})

describe('引擎集成', () => {
  it('传问占时刻 → 自动算旺衰，并带待核验说明', () => {
    const r = ichingLiujiaoEngine.compute(
      { at: { year: 2026, month: 9, day: 16, hour: 10 } },
      createRandomSource('ws')
    )
    expect(r.wangshuai).toBeDefined()
    expect(r.wangshuai!.yao).toHaveLength(6)
    const it = ichingLiujiaoEngine.interpret(r)
    const keys = it.blocks.map((b) => b.key)
    expect(keys).toContain('wangShuaiMeta')
    expect(keys).toContain('wangShuai')
    expect(keys).toContain('wangShuaiCaveat')
  })

  it('不给时刻 → 不算旺衰（不做"看起来合理"的默认值）', () => {
    const r = ichingLiujiaoEngine.compute({}, createRandomSource('ws'))
    expect(r.najia).toBeDefined()
    expect(r.wangshuai).toBeUndefined()
    const keys = ichingLiujiaoEngine.interpret(r).blocks.map((b) => b.key)
    expect(keys).not.toContain('wangShuai')
  })

  it('月建 / 日辰 / 旬空随时刻变化（同一卦不同日，旺衰可不同）', () => {
    const a = ichingLiujiaoEngine.compute(
      { at: { year: 2026, month: 1, day: 5, hour: 10 } },
      createRandomSource('ws')
    )
    const b = ichingLiujiaoEngine.compute(
      { at: { year: 2026, month: 7, day: 5, hour: 10 } },
      createRandomSource('ws')
    )
    expect(a.cast.benGua.index).toBe(b.cast.benGua.index) // 同种子同卦
    expect(a.wangshuai!.yueZhi).not.toBe(b.wangshuai!.yueZhi)
  })
})
