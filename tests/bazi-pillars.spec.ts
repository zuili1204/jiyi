import { describe, it, expect } from 'vitest'
import { baziPillars, pillarsText } from '@/engine/bazi/pillars'
import { baziEngine, buildBaziRecord, BAZI_POLICIES } from '@/engine/bazi'

/**
 * 八字四柱排盘（Y4-01）
 *
 * 纪律：golden 未采集（Y0-04 / Y4-09），所以这里**不测"柱子对不对"**。
 * 只测能被测的：结构完整、干支合法、真太阳时链路、口径可见、区间硬拦截、PII 标注。
 */
const AT = { year: 1990, month: 6, day: 15, hour: 14, minute: 30 }

describe('四柱结构', () => {
  it('四柱齐全且干支合法（两字、落在六十甲子内）', () => {
    const r = baziPillars(AT)
    const t = pillarsText(r.pillars)
    for (const v of Object.values(t)) {
      expect(v).toHaveLength(2)
    }
    // 六十甲子：天干 10 × 地支 12 的合法组合（同奇偶配对）
    const GAN = '甲乙丙丁戊己庚辛壬癸'
    const ZHI = '子丑寅卯辰巳午未申酉戌亥'
    for (const [i, v] of Object.values(t).entries()) {
      expect(GAN.includes(v[0])).toBe(true)
      expect(ZHI.includes(v[1])).toBe(true)
      expect(GAN.indexOf(v[0]) % 2).toBe(ZHI.indexOf(v[1]) % 2)
      expect(i).toBeGreaterThanOrEqual(0)
    }
  })

  it('确定性：同一输入两次结果一致', () => {
    expect(pillarsText(baziPillars(AT).pillars)).toEqual(pillarsText(baziPillars(AT).pillars))
  })

  it('超出历法区间直接抛错，不返回"看起来合理"的错值（YR1）', () => {
    expect(() => baziPillars({ ...AT, year: 1849 })).toThrow()
  })
})

describe('真太阳时（Y1-07 接经度表）', () => {
  it('出生地命中内置表 → 订正生效，且排盘用订正后时刻', () => {
    const r = baziPillars({ ...AT, place: '乌鲁木齐' })
    expect(r.trueSolar).toBeDefined()
    // 乌鲁木齐约 87.6°E，对 120°E 订正约 −129.6 分钟
    expect(r.trueSolar!.longitudeMinutes).toBeLessThan(-100)
    expect(r.trueSolar!.correctedText).not.toBe('')
    // 订正后时刻确实变了（跨了两个多小时）
    expect(r.usedAt.hour).not.toBe(AT.hour)
  })

  it('出生地未命中 → 明确标记未订正，不做近似替代（YR2）', () => {
    const r = baziPillars({ ...AT, place: '火星上的城市' })
    expect(r.trueSolar).toBeUndefined()
    expect(r.placeUnresolved).toBe(true)
    expect(r.usedAt).toEqual(AT)
  })

  it('关闭真太阳时 → 原时刻排盘', () => {
    const r = baziPillars({ ...AT, place: '乌鲁木齐', useTrueSolar: false })
    expect(r.trueSolar).toBeUndefined()
    expect(r.usedAt).toEqual(AT)
  })
})

describe('结果页口径与合规', () => {
  it('三项暂定口径必须可见（换年 / 早晚子时 / 闰月）', () => {
    const interp = baziEngine.interpret(baziEngine.compute(AT, { next: () => 0, int: () => 0 }))
    const all = interp.blocks.map((b) => b.text).join('\n')
    expect(all).toContain('换年：立春')
    expect(all).toContain('晚子时归当日')
    expect(all).toContain('以节气为界分段')
    expect(BAZI_POLICIES.reviewed).toBe(false)
  })

  it('十神 / 格局 / 大运已落地，但仍不编造命理解读 / 断语', () => {
    const interp = baziEngine.interpret(baziEngine.compute(AT, { next: () => 0, int: () => 0 }))
    const labels = interp.blocks.map((b) => b.label).join('\n')
    const all = interp.blocks.map((b) => b.text).join('\n')
    expect(labels).toContain('十神（天干）')
    expect(labels).toContain('格局（月令取格）')
    expect(labels).toContain('地支藏干十神')
    expect(labels).toContain('大运')
    expect(labels).toContain('当前流年')
    // 不写断语：不含绝对化 / 凶灾措辞
    for (const banned of ['大吉', '凶', '必', '一定', '注定']) expect(all).not.toContain(banned)
  })

  it('出生数据标记为 PII：导出与分享一律剔除', () => {
    const rec = buildBaziRecord({ ...AT, place: '北京', gender: 'male' }, 'bazi-1')
    expect(rec.kind).toBe('bazi')
    expect(rec.piiFields).toEqual(['input.at', 'input.place', 'input.gender'])
    expect(rec.interpretation.basis?.['policies']).toBeDefined()
  })
})
