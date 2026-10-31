import { describe, it, expect } from 'vitest'
import { loadGoldenSuite } from './helpers'
import { fourPillars, type DateTimeInput } from '@/engine/calendar'
import { Lunar } from 'lunar-typescript'
import { shiShenOf } from '@/engine/bazi/shiShen'
import { baziPillars, computeDaYun, computeRelations } from '@/engine/bazi'
import {
  LIU_HE,
  LIU_CHONG,
  ganZhiFromText,
  type FourPillars
} from '@/engine/calendar'
import {
  SAN_HE_GROUP,
  SAN_XING_PAIRS,
  ZI_XING,
  LIU_HAI,
  WU_HE
} from '@/engine/bazi/relations'

/**
 * 八字 golden（Y0-04 / Y4-09）
 *
 * 纪律（同 ziwei / qimen golden）：
 * - `todo: true` 显式 pending 并计数，不 skip；
 * - 日 / 时柱第二源 = `lunisolar@2.6.0`（MIT，零依赖、干支历自研，**非同源**于 6tail 系，YR25）；
 *   立春 / 节气边界（bazi-001）年（月）柱按权威节气时刻（公历天文年历）判定；
 *   真太阳时订正第二源 = NOAA 太阳黄经算法（与引擎 Spencer 近似式异源），见各用例 source；
 * - 先实现 runner 再接用例。
 */
const suite = loadGoldenSuite('bazi')

type PillarLike = { gan: string; zhi: string }
const gz = (g: PillarLike) => g.gan + g.zhi

const ZHI_12 = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const
const GAN_10 = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const

/** `Record<支, 支>` → 去重后的「两两一组」规范形式（按十二支序，先出现者在前） */
function pairsOf(rec: Record<string, string>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const z of ZHI_12) {
    const p = rec[z]
    if (!p) continue
    const key = [z, p].sort().join('')
    if (!seen.has(key)) {
      seen.add(key)
      out.push(z + p)
    }
  }
  return out
}

/** 天干版（同 `pairsOf`，按十干序） */
function pairsOfGan(rec: Record<string, string>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const g of GAN_10) {
    const p = rec[g]
    if (!p) continue
    const key = [g, p].sort().join('')
    if (!seen.has(key)) {
      seen.add(key)
      out.push(g + p)
    }
  }
  return out
}

/** golden 输入 → 公历 DateTimeInput（calendar: lunar 时先转公历） */
function toSolar(input: {
  calendar?: string
  year: number
  month: number
  day: number
  hour: number
  minute: number
  isLeap?: boolean
}): DateTimeInput {
  if (input.calendar === 'lunar') {
    const y = Lunar.fromYmd(input.year, input.isLeap ? -input.month : input.month, input.day)
    const s = y.getSolar()
    return { year: s.getYear(), month: s.getMonth(), day: s.getDay(), hour: input.hour, minute: input.minute }
  }
  return { year: input.year, month: input.month, day: input.day, hour: input.hour, minute: input.minute }
}

describe('八字 golden（Y4-09）', () => {
  const todoCount = suite.cases.filter((c) => c.todo).length
  const readyCount = suite.cases.length - todoCount

  // 20 为 JY-02 §5.1 的**下限**（2026-09-23 起允许扩充，用于为刑冲合害等子模块补 golden）
  it('数据集结构完整（用例数不低于下限 20）', () => {
    expect(suite.cases.length).toBeGreaterThanOrEqual(20)
    for (const c of suite.cases) expect(c.source, `${c.id} 缺 source`).toBeTruthy()
  })

  it('school 字面一致（子平法）', () => {
    const school = (suite as unknown as { school?: string }).school ?? ''
    expect(school).toContain('子平')
    for (const c of suite.cases) expect(c.school).toContain('子平')
  })

  it('缺口可见：未采集用例数被统计出来（不是被跳过）', () => {
    console.log(`[golden] bazi：已入库 ${readyCount} / 待采集 ${todoCount}`)
    if (todoCount > 0) expect(todoCount).toBeGreaterThan(0)
  })

  for (const c of suite.cases) {
    if (c.todo) {
      it.todo(`[待采集] ${c.id} — ${c.note ?? c.method}`)
      continue
    }

    // 十神用例无日期，跳过 baziPillars 构造
    const isDateMethod = c.method === 'pillars' || c.method === 'daYun' || c.method === 'liuNian'
    let r: ReturnType<typeof baziPillars> | undefined
    if (isDateMethod) {
      // 统一构造 baziPillars 入参（含真太阳时开关，lunar→solar 已转）
      const sol = toSolar(c.input as Parameters<typeof toSolar>[0])
      const bpInput = {
        year: sol.year,
        month: sol.month,
        day: sol.day,
        hour: sol.hour,
        minute: sol.minute,
        gender: (c.input as { gender?: 'male' | 'female' }).gender,
        place: (c.input as { place?: string }).place,
        // 真太阳时：有 place 且未显式 false 即开启订正
        useTrueSolar: (c.input as { trueSolar?: boolean }).trueSolar !== false
      } as any
      r = baziPillars(bpInput)
    }

    if (c.method === 'pillars') {
      it(`${c.id} 四柱与权威双源一致（${c.sourceKind}）`, () => {
        const e = c.expect as {
          year: string
          month: string
          day: string
          time: string
          correctionMinutes?: number
        }
        const midnight = (c.input as { midnight?: number }).midnight ?? 2
        // baziPillars 内部不处理晚子时口径，须用 usedAt + fourPillars(midnight)
        const p = fourPillars(r!.usedAt, { midnight: midnight as 1 | 2 })
        expect(gz(p.year), `${c.id} 年柱`).toBe(e.year)
        expect(gz(p.month), `${c.id} 月柱`).toBe(e.month)
        expect(gz(p.day), `${c.id} 日柱`).toBe(e.day)
        expect(gz(p.time), `${c.id} 时柱`).toBe(e.time)
        if (e.correctionMinutes !== undefined) {
          expect(r!.trueSolar?.totalMinutes, `${c.id} 真太阳时订正分钟`).toBeCloseTo(e.correctionMinutes, 0)
        }
      })
      continue
    }

    if (c.method === 'shiShen') {
      it(`${c.id} 十神与典籍一致（${c.sourceKind}）`, () => {
        const e = c.expect as { shiShen: string }
        const inp = c.input as { dayMaster: string; other: string }
        expect(shiShenOf(inp.dayMaster as any, inp.other as any)).toBe(e.shiShen)
      })
      continue
    }

    if (c.method === 'daYun') {
      it(`${c.id} 大运起运与顺逆（${c.sourceKind}）`, () => {
        const dy = computeDaYun(c.input as any, r!)
        const e = c.expect as {
          qiYunYears?: number
          qiYunMonths?: number
          qiYunDays?: number
          direction?: string
        }
        expect(dy.direction, `${c.id} 顺逆`).toBe(e.direction)
        expect(dy.qiYun?.years, `${c.id} 起运岁`).toBe(e.qiYunYears)
        if (e.qiYunMonths !== undefined) expect(dy.qiYun?.months, `${c.id} 起运月`).toBe(e.qiYunMonths)
        if (e.qiYunDays !== undefined) expect(dy.qiYun?.days, `${c.id} 起运日(运日)`).toBe(e.qiYunDays)
      })
      continue
    }

    if (c.method === 'liuNian') {
      it(`${c.id} 流年干支与十神（${c.sourceKind}）`, () => {
        const e = c.expect as { ganZhi: string; shiShen: string }
        const lnYear = (c.input as { liuNian?: number }).liuNian ?? new Date().getFullYear()
        // 流年按「公历年柱以立春分界」：取该年立春之后（年中）时刻
        const yearGz = fourPillars({ year: lnYear, month: 6, day: 15, hour: 12, minute: 0 }).year
        expect(yearGz.text, `${c.id} 流年干支`).toBe(e.ganZhi)
        expect(shiShenOf(r!.pillars.day.gan, yearGz.gan), `${c.id} 流年十神`).toBe(e.shiShen)
      })
      continue
    }

    /**
     * 刑冲合害**关系表**本身（表级覆盖，比单条四柱更能支撑 `reviewed` 转正）。
     * 表为 `Record<支, 支>`，此处按十二支序去重还原成「两两一组」的规范形式。
     */
    if (c.method === 'relationsTable') {
      it(`${c.id} 干支关系表与权威一致（${c.sourceKind}）`, () => {
        const { table } = c.input as { table: string }
        const e = c.expect as Record<string, unknown>
        if (table === 'liuHe') expect(pairsOf(LIU_HE), `${c.id} 六合`).toEqual(e.liuHe)
        if (table === 'liuChong') expect(pairsOf(LIU_CHONG), `${c.id} 六冲`).toEqual(e.liuChong)
        if (table === 'liuHai') expect(pairsOf(LIU_HAI), `${c.id} 六害`).toEqual(e.liuHai)
        if (table === 'wuHe') expect(pairsOfGan(WU_HE), `${c.id} 天干五合`).toEqual(e.wuHe)
        if (table === 'sanHe') expect(SAN_HE_GROUP, `${c.id} 三合局`).toEqual(e.sanHe)
        if (table === 'xing') {
          expect(SAN_XING_PAIRS, `${c.id} 三刑`).toEqual(e.sanXing)
          expect(ZI_XING, `${c.id} 自刑`).toEqual(e.ziXing)
        }
      })
      continue
    }

    /** 端到端：给定四柱 → computeRelations */
    if (c.method === 'relations') {
      it(`${c.id} 四柱干支关系判定（${c.sourceKind}）`, () => {
        const inp = c.input as {
          pillars: { year: string; month: string; day: string; time: string }
        }
        const p: FourPillars = {
          year: ganZhiFromText(inp.pillars.year),
          month: ganZhiFromText(inp.pillars.month),
          day: ganZhiFromText(inp.pillars.day),
          time: ganZhiFromText(inp.pillars.time)
        }
        const r = computeRelations(p)
        const e = c.expect as {
          liuChong?: string[]
          liuHe?: string[]
          xing?: string[]
          hai?: string[]
          wuHe?: string[]
        }
        const asPairs = (arr: Array<{ a: string; b: string }>) => arr.map((x) => x.a + x.b)
        if (e.liuChong) expect(asPairs(r.liuChong), `${c.id} 六冲`).toEqual(e.liuChong)
        if (e.liuHe) expect(asPairs(r.liuHe), `${c.id} 六合`).toEqual(e.liuHe)
        if (e.xing) expect(asPairs(r.xing), `${c.id} 刑`).toEqual(e.xing)
        if (e.hai) expect(asPairs(r.hai), `${c.id} 六害`).toEqual(e.hai)
        if (e.wuHe) expect(asPairs(r.wuHe), `${c.id} 天干五合`).toEqual(e.wuHe)
      })
      continue
    }

    throw new Error(`用例 ${c.id} 的 method「${c.method}」尚无执行器`)
  }
})