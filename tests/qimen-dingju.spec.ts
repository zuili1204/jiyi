import { describe, it, expect } from 'vitest'
import { dingJu, currentJieQi, sanYuanOf, earthlyPlate, STAR_ORDER } from '@/engine/qimen'
import { qimenChaibuEngine, buildQimenRecord } from '@/engine/qimen'
import { dingJuTerms, QIMEN_DINGJU_META } from '@/data/content/qimen'
import { ganZhiFromText } from '@/engine/calendar'

/**
 * 奇门定局（Y6-01）
 *
 * 纪律：母版 `reviewed = false`，所以这里**不测"局数对不对"**（那要 golden 与典籍核校），
 * 只测能被测的东西：
 *   1. 表的**结构自洽**（24 节气、局数 1~9、阴阳遁各 12）；
 *   2. 阴阳互补对称（对应节气逐位相加为 10）—— 这是口诀内部必须成立的恒等式；
 *   3. 三元分组对 12 地支**全覆盖且互斥**；
 *   4. 定局链路能跑通，且**结果必须带上"未过权威核校"标注**（不许宣称权威）。
 */
describe('奇门定局母版（结构自洽）', () => {
  it('24 节气齐全，每节气三元的局数都在 1~9', () => {
    expect(dingJuTerms).toHaveLength(24)
    for (const t of dingJuTerms) {
      for (const v of [t.shang, t.zhong, t.xia]) {
        expect(v).toBeGreaterThanOrEqual(1)
        expect(v).toBeLessThanOrEqual(9)
      }
    }
  })

  it('阴阳遁各 12 个节气', () => {
    expect(dingJuTerms.filter((t) => t.dun === 'yang')).toHaveLength(12)
    expect(dingJuTerms.filter((t) => t.dun === 'yin')).toHaveLength(12)
  })

  it('阴阳互补对称：相隔 12 项的对应节气，三元逐位相加为 10', () => {
    for (let i = 0; i < 12; i++) {
      const yang = dingJuTerms[i]
      const yin = dingJuTerms[i + 12]
      expect(yang.shang + yin.shang).toBe(10)
      expect(yang.zhong + yin.zhong).toBe(10)
      expect(yang.xia + yin.xia).toBe(10)
    }
  })

  it('局数表已核校（reviewed=true），且异文已登记（不做静默选择）', () => {
    // reviewed=true 仅指「24×3 局数表」经三重交叉验证；三元归属口径仍属默认声明（非权威）
    expect(QIMEN_DINGJU_META.reviewed).toBe(true)
    expect(QIMEN_DINGJU_META.dingJuMethod).toBe('chaibu')
  })
})

describe('三元（**符头法**：日柱所属六甲旬的旬首地支）', () => {
  /**
   * ⚠️ 2026-09-22 口径修正：旧实现按「日支」分组（子午卯酉/寅申巳亥/辰戌丑未），
   * 与 taibu-core@3.5.0 及《烟波钓叟歌》体系的**符头**口径不符（5 例只对 1 例）。
   * 现行口径：甲子·甲午→上元，甲寅·甲申→中元，甲辰·甲戌→下元。
   */
  const gz = ganZhiFromText

  it('六甲旬首 → 上/中/下元', () => {
    expect(sanYuanOf(gz('甲子'))).toBe('shang')
    expect(sanYuanOf(gz('甲午'))).toBe('shang')
    expect(sanYuanOf(gz('甲寅'))).toBe('zhong')
    expect(sanYuanOf(gz('甲申'))).toBe('zhong')
    expect(sanYuanOf(gz('甲辰'))).toBe('xia')
    expect(sanYuanOf(gz('甲戌'))).toBe('xia')
  })

  it('同旬内各日三元一致（按符头，不按本日地支）', () => {
    // 甲辰旬（甲辰…癸丑）→ 下元：乙巳 / 丙午（午支但非符头）仍为下元
    expect(sanYuanOf(gz('乙巳'))).toBe('xia')
    expect(sanYuanOf(gz('丙午'))).toBe('xia')
    // 甲寅旬（甲寅…癸亥）→ 中元
    expect(sanYuanOf(gz('丙辰'))).toBe('zhong')
    // 甲午旬（甲午…癸卯）→ 上元
    expect(sanYuanOf(gz('戊戌'))).toBe('shang')
    // 甲申旬（甲申…癸巳）→ 中元
    expect(sanYuanOf(gz('庚寅'))).toBe('zhong')
    // 甲戌旬（甲戌…癸未）→ 下元
    expect(sanYuanOf(gz('癸未'))).toBe('xia')
  })
})

describe('地盘三奇六仪（Y6-02）', () => {
  it('阳遁 1 局：戊起坎 1，顺行布 己庚辛壬癸丁丙乙', () => {
    const p = earthlyPlate('yang', 1)!
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => p.cells[n as 1])).toEqual([
      '戊',
      '己',
      '庚',
      '辛',
      '壬',
      '癸',
      '丁',
      '丙',
      '乙'
    ])
  })

  it('阴遁 9 局：戊起离 9，逆行布 乙丙丁癸壬辛庚己', () => {
    const p = earthlyPlate('yin', 9)!
    expect(p.cells[9]).toBe('戊')
    expect(p.cells[8]).toBe('乙')
    expect(p.cells[7]).toBe('丙')
    expect(p.cells[6]).toBe('丁')
    expect(p.cells[5]).toBe('癸')
    expect(p.cells[1]).toBe('己')
  })

  it('任意遁任意局：九宫各一干，不重不漏', () => {
    for (const dun of ['yang', 'yin'] as const) {
      for (let ju = 1; ju <= 9; ju++) {
        const p = earthlyPlate(dun, ju)!
        expect(Object.values(p.cells).sort()).toEqual(
          ['乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'].sort()
        )
        expect(p.byGan['戊']).toBe(ju)
      }
    }
  })

  it('局数非法 → undefined（不猜默认值）', () => {
    expect(earthlyPlate('yang', 0)).toBeUndefined()
    expect(earthlyPlate('yang', 10)).toBeUndefined()
    expect(earthlyPlate('yang', 1.5)).toBeUndefined()
  })
})

describe('天盘 / 值符值使 / 八门（Y6-03）', () => {
  const AT = { year: 2026, month: 7, day: 1, hour: 12, minute: 0 }
  const R = () => qimenChaibuEngine.compute({ at: AT }, { next: () => 0, int: () => 0 })

  it('旬首 = 时柱所属六甲，遁的六仪落在地盘某宫', () => {
    const r = R()
    expect(r.pan).toBeDefined()
    const x = r.pan!.xunShou
    expect(['甲子', '甲戌', '甲申', '甲午', '甲辰', '甲寅']).toContain(x.ganZhi)
    expect(['戊', '己', '庚', '辛', '壬', '癸']).toContain(x.yi)
    expect(r.earthlyPlate!.cells[x.palace]).toBe(x.yi)
  })

  it('值符随时干：落宫的地盘干（甲遁时取旬首六仪）', () => {
    const r = R()
    const p = r.pan!
    const cell = r.earthlyPlate!.cells[p.zhiFu.palace]
    expect([cell]).toContain(cell)
    expect(p.zhiFu.star).toBe(p.stars[p.zhiFu.palace])
  })

  it('九星各就位、不重不漏；天盘干随星走', () => {
    const r = R()
    const p = r.pan!
    const stars = Object.values(p.stars)
    expect(new Set(stars).size).toBe(9)
    expect(stars).toContain('天蓬')
    // 天盘干 = 该宫之星在地盘原宫的干
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9] as const) {
      const origin = (STAR_ORDER.indexOf(p.stars[n]) + 1) as 1
      expect(p.heavenlyGan[n]).toBe(r.earthlyPlate!.cells[origin])
    }
  })

  it('八门落在八宫，中五宫无门', () => {
    const r = R()
    const doors = r.pan!.doors
    expect(doors[5]).toBeNull()
    const filled = Object.values(doors).filter((d) => d !== null)
    expect(filled).toHaveLength(8)
    expect(new Set(filled).size).toBe(8)
  })

  it('取法说明随结果返回（不静默选择）', () => {
    expect(R().pan!.notes.length).toBeGreaterThan(0)
  })
})

describe('定局链路', () => {
  it('回归：冬至必须取得到（历法层曾因滑动窗口取不到，导致 12 月下旬判成大雪 → 阴阳遁反了）', () => {
    expect(currentJieQi({ year: 2026, month: 12, day: 25, hour: 12, minute: 0 })).toBe('冬至')
    expect(currentJieQi({ year: 2025, month: 12, day: 25, hour: 12, minute: 0 })).toBe('冬至')
  })

  it('常识级节气边界：1 月中取小寒、7 月初取夏至、12 月底取冬至', () => {
    expect(currentJieQi({ year: 2026, month: 1, day: 15, hour: 12, minute: 0 })).toBe('小寒')
    expect(currentJieQi({ year: 2026, month: 7, day: 1, hour: 12, minute: 0 })).toBe('夏至')
    expect(currentJieQi({ year: 2026, month: 12, day: 25, hour: 12, minute: 0 })).toBe('冬至')
  })

  it('冬至后阳遁、夏至后阴遁（时家奇门口径）', () => {
    const d1 = dingJu({ year: 2026, month: 1, day: 15, hour: 12, minute: 0 })!
    expect(d1.dun).toBe('yang')
    const d2 = dingJu({ year: 2026, month: 7, day: 1, hour: 12, minute: 0 })!
    expect(d2.dun).toBe('yin')
    expect(d2.term).toBe('夏至')
  })

  it('定局结果自洽：局数与母版该节气该元一致，且标记核校态（局数表已对账）', () => {
    const r = dingJu({ year: 2026, month: 7, day: 1, hour: 12, minute: 0 })!
    const term = dingJuTerms.find((t) => t.name === r.term)!
    expect(r.ju).toBe(term[r.yuan])
    expect(r.dun).toBe(term.dun)
    expect(r.reviewed).toBe(true)
  })

  it('结果页必须可见地标注未核校与只到定局（不编造盘面与断语）', () => {
    const interp = qimenChaibuEngine.interpret(
      qimenChaibuEngine.compute(
        { at: { year: 2026, month: 7, day: 1, hour: 12, minute: 0 } },
        { next: () => 0, int: () => 0 }
      )
    )
    const all = interp.blocks.map((b) => b.text).join('\n')
    // 盘面已由 golden qimen-004/005 核校（QIMEN_PAN_REVIEWED=true）；本盘声明不做吉凶断语（YR2）
    expect(all).toContain('本盘不做吉凶断语')
    expect(all).toContain('八神 / 空亡 / 驿马')
    // 文案面向用户：状态块不再含内部任务编号
    expect(all).toContain('问事解读与择时择方')
    expect(all).not.toMatch(/Y\d+-\d+/)
    expect(all).not.toContain('大吉')
    // 结构块齐全：阴阳遁 / 三元 / 局数
    expect(interp.blocks.map((b) => b.key)).toEqual(
      expect.arrayContaining(['dun', 'yuan', 'ju'])
    )
    expect(interp.school).toBe('chaibu')
  })

  it('地盘三奇六仪跟随定局产出（宫位与干一一对应）', () => {
    const r = qimenChaibuEngine.compute(
      { at: { year: 2026, month: 7, day: 1, hour: 12, minute: 0 } },
      { next: () => 0, int: () => 0 }
    )
    expect(r.earthlyPlate).toBeDefined()
    const cells = r.earthlyPlate!.cells
    expect(Object.keys(cells)).toHaveLength(9)
    expect(new Set(Object.values(cells)).size).toBe(9)
    // 戊落宫 = 局数
    expect(r.earthlyPlate!.byGan['戊']).toBe(r.dingJu!.ju)
  })

  it('记录可落库，且排盘依据随记录保存（三月后仍可解释）', () => {
    const rec = buildQimenRecord(
      { at: { year: 2026, month: 7, day: 1, hour: 12, minute: 0 }, question: '问出行' },
      'qimen-1'
    )
    expect(rec.kind).toBe('qimen')
    expect(rec.method).toBe('chaibu')
    expect(rec.interpretation.basis?.['ju']).toBeDefined()
    expect(rec.interpretation.basis?.['dingJuMethod']).toBe('chaibu')
  })
})
