import { describe, it, expect } from 'vitest'
import { makeGanZhi, type FourPillars, type DiZhi, type TianGan } from '@/engine/calendar'
import {
  computeGeJu,
  computeStrength,
  findHuiJu,
  findWaiGe,
  wangShuaiStateOf,
  rootWeightOf,
  changShengOf,
  CHANG_SHENG,
  ZHI_BEN_QI
} from '@/engine/bazi/geJu'
import { GAN_WU_XING } from '@/engine/calendar'

const mk = (g: TianGan, z: DiZhi) => makeGanZhi(g, z)

describe('十二长生表', () => {
  it('八干长生位与通行口诀一致', () => {
    // 甲长生亥、乙长生午、丙戊长生寅、丁己长生酉、庚长生巳、辛长生子、壬长生申、癸长生卯
    expect(changShengOf('甲', '亥')).toBe('长生')
    expect(changShengOf('乙', '午')).toBe('长生')
    expect(changShengOf('丙', '寅')).toBe('长生')
    expect(changShengOf('戊', '寅')).toBe('长生')
    expect(changShengOf('丁', '酉')).toBe('长生')
    expect(changShengOf('己', '酉')).toBe('长生')
    expect(changShengOf('庚', '巳')).toBe('长生')
    expect(changShengOf('辛', '子')).toBe('长生')
    expect(changShengOf('壬', '申')).toBe('长生')
    expect(changShengOf('癸', '卯')).toBe('长生')
  })

  it('每干十二位齐全（覆盖全部地支）', () => {
    for (const g of Object.keys(CHANG_SHENG) as Array<keyof typeof CHANG_SHENG>) {
      expect(CHANG_SHENG[g]).toHaveLength(12)
    }
  })
})

describe('旺相休囚死', () => {
  it('以月令为当令者的四种关系', () => {
    const wx = (z: '子' | '寅' | '申' | '午') => GAN_WU_XING[ZHI_BEN_QI[z]]
    // 月令水：同我水=旺；当令生我木=相；我生当令金=休；我克当令土=囚；当令克我火=死
    expect(wangShuaiStateOf(wx('子'), 'water')).toBe('旺')
    expect(wangShuaiStateOf(wx('子'), 'wood')).toBe('相')
    expect(wangShuaiStateOf(wx('子'), 'metal')).toBe('休')
    expect(wangShuaiStateOf(wx('子'), 'earth')).toBe('囚')
    expect(wangShuaiStateOf(wx('子'), 'fire')).toBe('死')
  })
})

describe('通根', () => {
  it('本气 3 / 中气 2 / 余气 1 / 无根 0', () => {
    expect(rootWeightOf('甲', '寅')).toBe(3) // 寅本气甲
    expect(rootWeightOf('甲', '亥')).toBe(2) // 亥中气甲
    expect(rootWeightOf('戊', '寅')).toBe(1) // 寅余气戊
    expect(rootWeightOf('甲', '酉')).toBe(0)
  })
})

describe('会局 / 合局扫描', () => {
  it('三会方：寅卯辰 → 东方木局', () => {
    const r = findHuiJu(['寅', '卯', '辰', '酉'])
    const fang = r.find((x) => x.kind === '三会方')
    expect(fang?.wuXing).toBe('wood')
    expect(fang?.members).toEqual(['寅', '卯', '辰'])
  })

  it('三合成局与半合', () => {
    const full = findHuiJu(['申', '子', '辰', '午'])
    expect(full.some((x) => x.kind === '三合局（成局）' && x.wuXing === 'water')).toBe(true)
    const half = findHuiJu(['亥', '卯', '申'])
    expect(half.some((x) => x.kind === '三合局（半合）' && x.wuXing === 'wood')).toBe(true)
  })

  it('六合：子丑合土', () => {
    const r = findHuiJu(['子', '丑', '寅', '申'])
    const he = r.find((x) => x.kind === '六合')
    expect(he?.wuXing).toBe('earth')
    expect(he?.members).toEqual(['子', '丑'])
  })
})

describe('旺衰表（得令 + 得地 + 得势）', () => {
  it('得令：月令本气同类 → 旺(+4)', () => {
    // 日主甲木，月支寅（本气甲=木）→ 旺
    const p: FourPillars = {
      year: mk('甲', '寅'),
      month: mk('甲', '寅'),
      day: mk('甲', '寅'),
      time: mk('甲', '寅')
    }
    const s = computeStrength(p)
    expect(s.deLingState).toBe('旺')
    expect(s.deLingScore).toBe(4)
  })

  it('得地：通根按本/中/余气累加', () => {
    const p: FourPillars = {
      year: mk('癸', '亥'),
      month: mk('壬', '子'),
      day: mk('甲', '寅'),
      time: mk('庚', '午')
    }
    const s = computeStrength(p)
    // 甲根：寅(本气3) + 亥(中气2)
    expect(s.deDiScore).toBe(5)
  })

  it('得势：生扶 +1 / 克泄耗 -1（不含日主）', () => {
    const p: FourPillars = {
      year: mk('癸', '亥'), // 癸=正印 → 生扶
      month: mk('乙', '卯'), // 乙=劫财 → 生扶
      day: mk('甲', '寅'),
      time: mk('庚', '午') // 庚=七杀 → 克泄耗
    }
    const s = computeStrength(p)
    expect(s.deShiScore).toBe(1) // +1 +1 -1
  })

  it('分项齐全且综合分 = 得令 + 得地 + 得势', () => {
    const p: FourPillars = {
      year: mk('丙', '寅'),
      month: mk('丁', '卯'),
      day: mk('庚', '申'),
      time: mk('壬', '午')
    }
    const s = computeStrength(p)
    expect(s.score).toBe(s.deLingScore + s.deDiScore + s.deShiScore)
    expect(s.reasons.length).toBeGreaterThanOrEqual(4)
    expect(s.changSheng).toHaveLength(4)
  })
})

describe('外格', () => {
  it('专旺：一行得气（同类 ≥6/8 且身旺以上）→ 曲直仁寿格', () => {
    const p: FourPillars = {
      year: mk('甲', '寅'),
      month: mk('乙', '卯'),
      day: mk('甲', '寅'),
      time: mk('乙', '卯')
    }
    const s = computeStrength(p)
    const wg = findWaiGe(p, s)
    expect(wg).toBeDefined()
    expect(wg).toContain('曲直仁寿格')
  })

  it('非专旺 / 非从格时返回 undefined', () => {
    const p: FourPillars = {
      year: mk('丙', '寅'),
      month: mk('丁', '卯'),
      day: mk('庚', '申'),
      time: mk('壬', '午')
    }
    expect(findWaiGe(p, computeStrength(p))).toBeUndefined()
  })
})

describe('格局（补全版）', () => {
  it('结果含旺衰表 / 会局 / 入库 等新字段，且正格契约不变', () => {
    // 日主甲；月支午（本气丁=伤官）且年干透丁 → 伤官格（本气透干）
    const p: FourPillars = {
      year: mk('丁', '卯'),
      month: mk('甲', '午'),
      day: mk('甲', '子'),
      time: mk('癸', '酉')
    }
    const gj = computeGeJu(p)
    expect(gj.geJu).toBe('伤官格')
    expect(gj.geJuBasis).toContain('本气透干')
    expect(gj.strengthDetail.score).toBeTypeOf('number')
    expect(Array.isArray(gj.huiJu)).toBe(true)
    expect(gj.note).toContain('会局')
    expect(gj.note).toContain('暂定口径')
  })

  it('月支为四库 → 给出入库信息', () => {
    const p: FourPillars = {
      year: mk('甲', '辰'),
      month: mk('乙', '未'),
      day: mk('丙', '戌'),
      time: mk('丁', '丑')
    }
    const gj = computeGeJu(p)
    expect(gj.kuInfo?.zhi).toBe('未')
  })
})
