import { describe, it, expect } from 'vitest'
import { baziPillars } from '@/engine/bazi/pillars'
import { shiShenOf, computeShiShen, cangGanShiShen } from '@/engine/bazi/shiShen'
import { computeGeJu, ZHI_BEN_QI } from '@/engine/bazi/geJu'
import { computeDaYun } from '@/engine/bazi/daYun'
import { makeGanZhi, type FourPillars, type TianGan, type DiZhi } from '@/engine/calendar'

/**
 * 八字 十神 / 格局 / 大运（Y4-02 / Y4-03）
 *
 * 纪律：golden 未采集（Y4-09），所以这里**不测绝对对错**，只测：
 * - 十神定义与 JY-02 §6.1 口径一致（阴阳异同定正偏）；
 * - 取格 / 五行分布 / 顺逆 / 起运结构完整、取值合法；
 * - 不填性别时只给流年、明确标注需性别（不猜顺逆）。
 */

describe('十神定义（JY-02 §6.1）', () => {
  it('日主甲：十神对照表', () => {
    const dm = '甲' as const
    expect(shiShenOf(dm, '甲')).toBe('比肩')
    expect(shiShenOf(dm, '乙')).toBe('劫财')
    expect(shiShenOf(dm, '丙')).toBe('食神')
    expect(shiShenOf(dm, '丁')).toBe('伤官')
    expect(shiShenOf(dm, '戊')).toBe('偏财')
    expect(shiShenOf(dm, '己')).toBe('正财')
    expect(shiShenOf(dm, '庚')).toBe('七杀')
    expect(shiShenOf(dm, '辛')).toBe('正官')
    expect(shiShenOf(dm, '壬')).toBe('偏印')
    expect(shiShenOf(dm, '癸')).toBe('正印')
  })

  it('日主为日柱自身，记为「日主」而非十神', () => {
    const p = baziPillars({ year: 1990, month: 6, day: 15, hour: 14, minute: 30 }).pillars
    const ss = computeShiShen(p)
    expect(ss.dayMaster).toBe(p.day.gan)
    expect(ss.byPillar.day.shiShen).toBe('日主')
  })
})

describe('地支本气（取格依据）', () => {
  it('本气表与通行口诀一致', () => {
    expect(ZHI_BEN_QI['子']).toBe('癸')
    expect(ZHI_BEN_QI['寅']).toBe('甲')
    expect(ZHI_BEN_QI['午']).toBe('丁')
    expect(ZHI_BEN_QI['申']).toBe('庚')
    expect(ZHI_BEN_QI['亥']).toBe('壬')
  })
})

describe('格局 + 五行分布', () => {
  it('结构完整且五行分布八位计满', () => {
    const p = baziPillars({ year: 1990, month: 6, day: 15, hour: 14, minute: 30 }).pillars
    const gj = computeGeJu(p)
    expect(gj.geJu).toContain('格')
    const total = Object.values(gj.wuXingDist).reduce((a, b) => a + b, 0)
    expect(total).toBe(8) // 四干 + 四支本气
    expect(['wood', 'fire', 'earth', 'metal', 'water']).toContain(gj.dayMasterWuXing)
  })

  it('透干取格：月令本气比劫、中气透干 → 取中气格', () => {
    // 日主甲；月支寅（本气甲=比肩、中气丙=食神、余气戊=偏财）；四干含丙透出
    const mk = (g: TianGan, z: DiZhi) => makeGanZhi(g, z)
    const p: FourPillars = {
      year: mk('丙', '寅'),
      month: mk('甲', '寅'),
      day: mk('甲', '子'),
      time: mk('丙', '寅')
    }
    const gj = computeGeJu(p)
    expect(gj.geJu).toBe('食神格')
    expect(gj.geJuBasis).toContain('中气透干')
  })

  it('透干取格：本气非比劫且透 → 取本气格', () => {
    // 日主甲；月支午（本气丁=伤官、中气己=正财），天干透丁 → 伤官格
    const mk = (g: TianGan, z: DiZhi) => makeGanZhi(g, z)
    const p: FourPillars = {
      year: mk('丁', '卯'),
      month: mk('甲', '午'),
      day: mk('甲', '子'),
      time: mk('癸', '酉')
    }
    const gj = computeGeJu(p)
    expect(gj.geJu).toBe('伤官格')
    expect(gj.geJuBasis).toContain('本气透干')
  })
})

describe('地支藏干十神', () => {
  it('寅支（日主甲）：甲本气→比肩、丙中气→食神、戊余气→偏财', () => {
    const ss = cangGanShiShen('甲', '寅')
    expect(ss).toHaveLength(3)
    expect(ss[0]).toMatchObject({ gan: '甲', layer: '本气', shiShen: '比肩' })
    expect(ss[1]).toMatchObject({ gan: '丙', layer: '中气', shiShen: '食神' })
    expect(ss[2]).toMatchObject({ gan: '戊', layer: '余气', shiShen: '偏财' })
  })

  it('子支仅本气癸；computeShiShen 四柱均含 byBranch', () => {
    const r = computeShiShen(
      (() => {
        const mk = (g: TianGan, z: DiZhi) => makeGanZhi(g, z)
        return {
          year: mk('甲', '子'),
          month: mk('甲', '子'),
          day: mk('甲', '子'),
          time: mk('甲', '子')
        } as FourPillars
      })()
    )
    expect(r.byBranch.year[0]).toMatchObject({ gan: '癸', shiShen: '正印' })
    expect(r.byBranch.month).toHaveLength(1)
    expect(r.byBranch.day).toHaveLength(1)
    expect(r.byBranch.time).toHaveLength(1)
  })
})

describe('大运顺逆与起运', () => {
  const AT = { year: 1990, month: 6, day: 15, hour: 14, minute: 30 }

  it('顺逆：阳男阴女顺、阳年女逆、阴年男逆', () => {
    const p = baziPillars(AT)
    expect(computeDaYun({ ...AT, gender: 'male' }, p).direction).toBe('forward')
    expect(computeDaYun({ ...AT, gender: 'female' }, p).direction).toBe('reverse')
    const yin = baziPillars({ ...AT, year: 1991 })
    expect(computeDaYun({ ...AT, year: 1991, gender: 'female' }, yin).direction).toBe('forward')
    expect(computeDaYun({ ...AT, year: 1991, gender: 'male' }, yin).direction).toBe('reverse')
  })

  it('给性别 → 起运与 8 步大运齐全，首步起始年龄 = 起运岁数', () => {
    const full = baziPillars(AT)
    const dy = computeDaYun({ ...AT, gender: 'male' }, full)
    expect(dy.needsGender).toBe(false)
    expect(dy.qiYun).toBeDefined()
    expect(dy.qiYun!.years).toBeGreaterThanOrEqual(0)
    expect(dy.qiYun!.months).toBeGreaterThanOrEqual(0)
    expect(dy.qiYun!.months).toBeLessThan(12)
    expect(dy.steps).toHaveLength(8)
    expect(dy.steps[0].startAge).toBe(dy.qiYun!.years)
    expect(dy.steps[1].startAge).toBe(dy.qiYun!.years + 10)
    expect(dy.liuNian).toBeDefined()
  })

  it('精确起运：岁 / 月 / 运日按分钟折算，量与量级自洽', () => {
    const full = baziPillars(AT)
    const dy = computeDaYun({ ...AT, gender: 'male' }, full)
    expect(dy.qiYun).toBeDefined()
    const qy = dy.qiYun!
    expect(qy.years).toBeGreaterThanOrEqual(0)
    expect(qy.months).toBeGreaterThanOrEqual(0)
    expect(qy.months).toBeLessThan(12) // 折算 1 岁 = 12 运月
    expect(qy.days).toBeGreaterThanOrEqual(0)
    expect(qy.days).toBeLessThan(30) // 1 运月 = 30 运日
    // 数值自洽：岁 × 4320 分 + 月 × 360 分 + 运日 × 12 分必须落在原折算时长内
    // 1 运日 = 12 分 = 1 时辰(2h)/10，是折算可表达的最小整格
    // 首步带精确起运月 / 日，第二步起整十年一格，不带
    expect(dy.steps).toHaveLength(8)
    if (qy.months > 0 || qy.days > 0) {
      expect(dy.steps[0].startMonths).toBe(qy.months)
      expect(dy.steps[0].startDays).toBe(qy.days)
    }
    expect(dy.steps[1].startMonths).toBeUndefined()
    expect(dy.steps[1].startAge).toBe(dy.qiYun!.years + 10)
  })

  it('不给性别 → 只给流年，明确需性别，不猜顺逆', () => {
    const full = baziPillars(AT)
    const dy = computeDaYun({ ...AT }, full)
    expect(dy.needsGender).toBe(true)
    expect(dy.direction).toBeUndefined()
    expect(dy.steps).toHaveLength(0)
    expect(dy.liuNian).toBeDefined()
  })
})
