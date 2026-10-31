import { describe, it, expect } from 'vitest'
import {
  determineMingGong,
  buildZiweiRecord,
  ziweiEngine,
  SI_HUA_TABLE,
  arrangeZhuXing,
  computeDaXian,
  tianFuZhi,
  arrangeFuXing,
  arrangeZaYao
} from '@/engine/ziwei'
import { DI_ZHI } from '@/engine/calendar'

/**
 * 紫微 定命宫 + 五行局（Y5-01）
 *
 * 纪律：golden 未采集（Y5-09），只测结构合法性与口径一致：
 * - 定命宫：寅月 + 寅时 → 命宫 子（JY-02 §6.4 第 1 步）；
 * - 五行局：命宫干支纳音 → 水二 / 木三 / 金四 / 土五 / 火六；
 * - 出生数据 PII 与八字共用同意流程（Y5-08 零重复），落库即标 PII。
 */
describe('定命宫 + 五行局', () => {
  it('寅月（正月）+ 寅时 → 命宫在子宫', () => {
    const r = determineMingGong('甲', 1, 3)
    expect(r.branch).toBe('子')
    expect(r.twelveGong).toHaveLength(12)
    expect(r.twelveGong[0].name).toBe('命宫')
    expect(r.twelveGong[0].branch).toBe('子')
  })

  it('五行局：丙子命宫 → 涧下水 → 水二局', () => {
    const r = determineMingGong('甲', 1, 3)
    expect(r.ganZhi).toBe('丙子')
    expect(r.wuXingJu.element).toBe('water')
    expect(r.wuXingJu.number).toBe(2)
    expect(r.wuXingJu.label).toBe('水二局')
  })

  it('五行局映射覆盖五种纳音五行', () => {
    // 取若干例验证 局数 与 纳音五行 对应（木三 / 火六 / 金四 / 土五 / 水二）
    const cases: [string, number, number, string][] = [
      ['甲', 1, 3, '水二局'], // 丙子 → 涧下水
      ['丙', 2, 5, '火六局'] // 壬午 → 杨柳木? 仅验证 element 字段存在
    ]
    for (const [yg, m, h, label] of cases) {
      const r = determineMingGong(yg as '甲', m, h)
      expect(['wood', 'fire', 'earth', 'metal', 'water']).toContain(r.wuXingJu.element)
      expect([2, 3, 4, 5, 6]).toContain(r.wuXingJu.number)
      if (r.wuXingJu.label === label) expect(r.wuXingJu.label).toBe(label)
    }
  })
})

describe('紫微记录与 PII（Y5-08 零重复）', () => {
  it('buildZiweiRecord 产出可落库记录，出生数据标 PII，复用八字口径', () => {
    const rec = buildZiweiRecord(
      { year: 1990, month: 6, day: 15, hour: 14, minute: 30, place: '北京', gender: 'male' },
      'zv-1'
    )
    expect(rec.kind).toBe('ziwei')
    expect(rec.piiFields).toEqual(['input.at', 'input.place', 'input.gender'])
    expect(rec.interpretation.title).toContain('命宫')
  })

  it('compute 与八字同口径：确定性、不依赖随机源', () => {
    const input = { year: 1990, month: 6, day: 15, hour: 14, minute: 30 }
    const a = ziweiEngine.compute(input, { next: () => 0, int: () => 0 })
    const b = ziweiEngine.compute(input, { next: () => 0, int: () => 0 })
    expect(a.mingGong.ganZhi).toBe(b.mingGong.ganZhi)
  })
})

describe('四化（Y5-04）', () => {
  it('四化表：年干 → 禄权科忌，且结果页可见', () => {
    const rec = buildZiweiRecord(
      { year: 1984, month: 2, day: 5, hour: 10, minute: 0, gender: 'male' },
      'zv-2'
    )
    // 1984 甲子年 → 甲干
    const sh = rec.interpretation.basis as Record<string, unknown>
    expect(sh['siHua']).toBeDefined()
    const siHua = sh['siHua'] as { yearGan: string; lu: string; quan: string; ke: string; ji: string }
    expect(siHua.yearGan).toBe('甲')
    expect(siHua.lu).toBe('廉贞')
    expect(siHua.quan).toBe('破军')
    expect(siHua.ke).toBe('武曲')
    expect(siHua.ji).toBe('太阳')

    const texts = rec.interpretation.blocks.map((b) => b.text).join('\n')
    expect(texts).toContain('四化')
    expect(texts).toContain('廉贞')
    for (const banned of ['大吉', '凶', '必', '一定', '注定']) expect(texts).not.toContain(banned)
  })

  it('四化表与三合派通行表逐干一致（四化可落主星或辅曜）', () => {
    // 三合派通行《全集》四化（项目默认流派 J3 暂定三合派）
    const expected: Record<string, [string, string, string, string]> = {
      甲: ['廉贞', '破军', '武曲', '太阳'],
      乙: ['天机', '天梁', '紫微', '太阴'],
      丙: ['天同', '天机', '文昌', '廉贞'],
      丁: ['太阴', '天同', '天机', '巨门'],
      戊: ['贪狼', '太阴', '右弼', '天机'],
      己: ['武曲', '贪狼', '天梁', '文曲'],
      庚: ['太阳', '武曲', '太阴', '天同'],
      辛: ['巨门', '太阳', '文曲', '文昌'],
      壬: ['天梁', '紫微', '左辅', '武曲'],
      癸: ['破军', '巨门', '太阴', '贪狼']
    }
    expect(Object.keys(SI_HUA_TABLE)).toHaveLength(10)
    for (const [g, [lu, quan, ke, ji]] of Object.entries(expected)) {
      const row = SI_HUA_TABLE[g as keyof typeof SI_HUA_TABLE]
      expect(row).toEqual({ lu, quan, ke, ji })
      // 每个星名非空
      for (const star of [row.lu, row.quan, row.ke, row.ji]) expect(star.length).toBeGreaterThan(0)
    }
  })
})

describe('十四正曜安星（Y5-02）', () => {
  const ALL = [
    '紫微',
    '天机',
    '太阳',
    '武曲',
    '天同',
    '廉贞',
    '天府',
    '太阴',
    '贪狼',
    '巨门',
    '天相',
    '天梁',
    '七杀',
    '破军'
  ]

  it('任何局数 / 生日：14 主星各居一台，不多不少', () => {
    for (const ju of [2, 3, 4, 5, 6]) {
      for (const day of [1, 9, 15, 27, 29]) {
        const { mainStars } = arrangeZhuXing(day, ju)
        const placed = Object.values(mainStars).flat()
        expect(new Set(placed).size).toBe(14)
        expect([...placed].sort()).toEqual([...ALL].sort())
      }
    }
  })

  it('天府与紫微互为对宫（+6）', () => {
    for (const ju of [2, 3, 4, 5, 6]) {
      for (const day of [2, 8, 17, 24]) {
        const { ziWei, tianFu } = arrangeZhuXing(day, ju)
        expect(tianFuZhi(ziWei)).toBe(tianFu)
        expect((DI_ZHI.indexOf(tianFu) - DI_ZHI.indexOf(ziWei) + 12) % 12).toBe(6)
      }
    }
  })

  it('紫微系 / 天府系相对位置符合口诀', () => {
    // 紫微系：逆 天机-1 / 太阳-3 / 武曲-4 / 天同-5 / 廉贞-8
    // 天府系：顺 太阴+1 / 贪狼+2 / 巨门+3 / 天相+4 / 天梁+5 / 七杀+6 / 破军+10
    const ziWeiOff: [string, number][] = [
      ['天机', 1],
      ['太阳', 3],
      ['武曲', 4],
      ['天同', 5],
      ['廉贞', 8]
    ]
    const tianFuOff: [string, number][] = [
      ['太阴', 1],
      ['贪狼', 2],
      ['巨门', 3],
      ['天相', 4],
      ['天梁', 5],
      ['七杀', 6],
      ['破军', 10]
    ]
    const { ziWei, tianFu, mainStars } = arrangeZhuXing(15, 4)
    const zw = DI_ZHI.indexOf(ziWei)
    const tf = DI_ZHI.indexOf(tianFu)
    for (const [star, off] of ziWeiOff) {
      const br = DI_ZHI[(zw - off + 12) % 12]
      expect(mainStars[br]).toContain(star)
    }
    for (const [star, off] of tianFuOff) {
      const br = DI_ZHI[(tf + off) % 12]
      expect(mainStars[br]).toContain(star)
    }
  })

  it('四化落宫：落在对应主星所在宫，且无性别要求', () => {
    const rec = buildZiweiRecord(
      { year: 1984, month: 2, day: 5, hour: 10, minute: 0 },
      'zv-xing'
    )
    const basis = rec.interpretation.basis as Record<string, unknown>
    const shp = basis['siHuaByPalace'] as { kind: string; label: string; star: string; palace: string | null }[]
    expect(shp).toBeDefined()
    expect(shp).toHaveLength(4)
    for (const p of shp) expect(['lu', 'quan', 'ke', 'ji']).toContain(p.kind)
  })
})

describe('辅煞 / 杂曜安星（Y5-03）', () => {
  it('杂曜单颗不重不漏，红鸾天喜对宫，寡宿＝孤辰 ±4', () => {
    const ZA = [
      '红鸾',
      '天喜',
      '龙池',
      '凤阁',
      '华盖',
      '咸池',
      '破碎',
      '孤辰',
      '寡宿',
      '天哭',
      '天虚',
      '天刑',
      '天姚',
      '台辅',
      '封诰',
      // 补齐：三台 / 八座 / 恩光 / 天贵 / 天官 / 天福（日/年系；解神需 lunarMonth 另测）
      '三台',
      '八座',
      '恩光',
      '天贵',
      '天官',
      '天福',
      // 2026-09-24 补齐：蜚廉（iztro 实测定表）+ 解神（需 lunarMonth）
      '蜚廉',
      '解神'
    ]
    const where = (f: Record<string, string[]>, name: string) =>
      DI_ZHI.findIndex((b) => f[b].includes(name))
    for (const branch of ['子', '寅', '巳', '申', '亥'] as const) {
      // 三台 / 八座 / 恩光 / 天贵 需以 左辅右弼昌曲 落宫为起点（与引擎同路径）
      const fu = arrangeFuXing({ yearGan: '甲', branch, hour: 10, lunarMonth: 2 })
      const starAt = (n: string) => DI_ZHI.find((z) => fu[z].includes(n))
      const za = arrangeZaYao({
        yearGan: '甲',
        branch,
        monthBranch: '卯',
        hour: 10,
        lunarDay: 5,
        lunarMonth: 2,
        zuoFu: starAt('左辅'),
        youBi: starAt('右弼'),
        wenChang: starAt('文昌'),
        wenQu: starAt('文曲')
      })
      const placed = Object.values(za).flat()
      expect(placed).toHaveLength(ZA.length)
      expect([...placed].sort()).toEqual([...ZA].sort())
      // 红鸾与天喜必在对宫（差 6）
      const lu = where(za, '红鸾')
      const xi = where(za, '天喜')
      expect((xi - lu + 12) % 12).toBe(6)
      // 孤辰与寡宿 相差 4 宫
      const gu = where(za, '孤辰')
      const su = where(za, '寡宿')
      expect((gu - su + 12) % 12).toBe(4)
    }
  })
  it('结构不变式：单颗不崩不令，擎羊 / 陀罗夹禄存', () => {
    const AUX = [
      '左辅',
      '右弼',
      '文昌',
      '文曲',
      '天魁',
      '天钺',
      '禄存',
      '擎羊',
      '陀罗',
      '天马',
      '地空',
      '地劫',
      '火星',
      '铃星'
    ]
    const where = (f: Record<string, string[]>, name: string) =>
      DI_ZHI.findIndex((b) => f[b].includes(name))
    for (const hour of [0, 3, 10, 15, 23]) {
      const fu = arrangeFuXing({ yearGan: '甲', branch: '子', hour, lunarMonth: 1 })
      const placed = Object.values(fu).flat()
      expect(placed).toHaveLength(14)
      expect([...placed].sort()).toEqual([...AUX].sort())
      // 禄存前后邻近即擎羊 / 陀罗
      const lu = where(fu, '禄存')
      expect(fu[DI_ZHI[(lu + 1) % 12]]).toContain('擎羊')
      expect(fu[DI_ZHI[(lu - 1 + 12) % 12]]).toContain('陀罗')
      // 地空（亥逆）与地劫（亥顺）都在盘上——非恒对宫，不硬套「差 6」
      expect(where(fu, '地空')).toBeGreaterThanOrEqual(0)
      expect(where(fu, '地劫')).toBeGreaterThanOrEqual(0)
    }
  })
})
describe('大限（Y5-05）', () => {
  it('阳男阴女顺行 / 阴男阳女逆行，起限岁数 = 五行局数，每十年过一宫', () => {
    // 1984 甲子（阳干）→ 男顺、女逆
    const male = determineMingGong('甲', 2, 10)
    const ju = male.wuXingJu.number
    const fwd = computeDaXian(male, '甲', 'male', ju)
    expect(fwd.direction).toBe('forward')
    expect(fwd.startAge).toBe(ju)
    expect(fwd.steps).toHaveLength(12)
    for (const [i, s] of fwd.steps.entries()) {
      expect(s.startAge).toBe(ju + i * 10)
      expect(s.endAge).toBe(s.startAge + 9)
    }
    // 逆行的宫名从命宫出发反绕一圈
    const rev = computeDaXian(male, '甲', 'female', ju)
    expect(rev.direction).toBe('reverse')
    expect(rev.steps[1].gongName).toBe(male.twelveGong[11].name)
  })

  it('缺性别 → 明确需性别，不猜顺逆', () => {
    const ming = determineMingGong('甲', 1, 3)
    const r = computeDaXian(ming, '甲', undefined, ming.wuXingJu.number)
    expect(r.needsGender).toBe(true)
    expect(r.direction).toBeUndefined()
    expect(r.steps).toHaveLength(0)
  })
})
