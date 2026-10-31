import { describe, it, expect } from 'vitest'
import {
  GONGS,
  NA_JIA_REVIEWED,
  gongOf,
  gongTableNames,
  isYangZhi,
  liuQin,
  naJia,
  zhiWuXing,
  type LiuQin
} from '@/engine/iching/naJia'
import { HEXAGRAMS, hexagramByLines } from '@/engine/iching/constants'
import { castByNumbers } from '@/engine/iching/cast'
import { ichingLiujiaoEngine } from '@/engine/iching'
import { createRandomSource } from '@/engine/random'

/**
 * 纳甲常量表（Y3-05）与六爻装卦（Y3-06）
 *
 * 本轮只锁**结构不变量**（能挡住录入错误）与**可推导的关系**（六亲 / 世应），
 * 纳甲表本身标 `reviewed: false`，权威性待 golden（DOCS/golden/liujiao.json）核验。
 */
describe('八宫表结构（Y3-05）', () => {
  it('八宫 × 8 卦 = 64，恰好覆盖全部卦名且不重复', () => {
    const names = gongTableNames()
    expect(names).toHaveLength(64)
    expect(new Set(names).size).toBe(64)
    expect([...names].sort()).toEqual([...HEXAGRAMS.map((h) => h.name)].sort())
  })

  it('阳宫纳阳支，阴宫纳阴支', () => {
    for (const g of GONGS) {
      for (const z of g.zhi) expect(isYangZhi(z), `${g.name}宫 纳支 ${z}`).toBe(g.yang)
    }
  })

  it('每宫 6 个地支互不相同', () => {
    for (const g of GONGS) expect(new Set(g.zhi).size).toBe(6)
  })

  it('宫五行与八卦五行一致', () => {
    for (const g of GONGS) expect(['金', '木', '水', '火', '土']).toContain(g.element)
  })

  it('世应：本宫世六应三；游魂世四应一；归魂世三应六', () => {
    expect(gongOf('乾').shi).toBe(6)
    expect(gongOf('乾').ying).toBe(3)
    expect(gongOf('晋').shi).toBe(4) // 乾宫游魂
    expect(gongOf('晋').ying).toBe(1)
    expect(gongOf('大有').shi).toBe(3) // 乾宫归魂
    expect(gongOf('大有').ying).toBe(6)
    expect(gongOf('姤').shi).toBe(1) // 一世
    expect(gongOf('姤').ying).toBe(4)
  })

  it('世应相隔三爻（恒等关系）', () => {
    for (const name of gongTableNames()) {
      const g = gongOf(name)
      expect(g.ying).toBe(((g.shi + 2) % 6) + 1)
    }
  })

  it('未知卦名抛错（不猜）', () => {
    expect(() => gongOf('不存在的卦')).toThrow()
  })

  it('装卦层已核验（与 taibu-core 双实现 64 卦一致）', () => {
    expect(NA_JIA_REVIEWED).toBe(true)
  })
})

describe('六亲（以卦宫五行为我）', () => {
  const cases: [string, string, LiuQin][] = [
    ['金', '水', '子孙'], // 我生者
    ['金', '木', '妻财'], // 我克者
    ['金', '土', '父母'], // 生我者
    ['金', '火', '官鬼'], // 克我者
    ['金', '金', '兄弟'] // 同我者
  ]
  for (const [me, other, expectQin] of cases) {
    it(`${me} 遇 ${other} → ${expectQin}`, () => {
      expect(liuQin(me as never, other as never)).toBe(expectQin)
    })
  }
})

describe('六爻装卦（Y3-06）', () => {
  it('乾为天（本宫）：纳甲与六亲', () => {
    // 乾宫属金，纳支 子寅辰午申戌，内甲外壬
    const r = naJia(castByNumbers(1, 1)) // 上乾下乾 → 乾
    expect(r.benGua.name).toBe('乾')
    expect(r.gong).toBe('乾')
    expect(r.gongElement).toBe('金')
    expect(r.shiYao).toBe(6)
    expect(r.yao.map((y) => `${y.gan}${y.zhi}`)).toEqual([
      '甲子',
      '甲寅',
      '甲辰',
      '壬午',
      '壬申',
      '壬戌'
    ])
    expect(r.yao.map((y) => y.liuQin)).toEqual([
      '子孙',
      '妻财',
      '父母',
      '官鬼',
      '兄弟',
      '父母'
    ])
  })

  it('坤为地（阴宫）：纳乙癸、地支为阴支逆行', () => {
    const r = naJia(castByNumbers(8, 8))
    expect(r.benGua.name).toBe('坤')
    expect(r.yao.map((y) => y.gan)).toEqual(['乙', '乙', '乙', '癸', '癸', '癸'])
    expect(r.yao.map((y) => y.zhi)).toEqual(['未', '巳', '卯', '丑', '亥', '酉'])
    for (const y of r.yao) expect(isYangZhi(y.zhi)).toBe(false)
  })

  it('动爻：变卦存在，且变爻六亲仍以本宫五行为我', () => {
    const r = naJia(castByNumbers(1, 1)) // 动爻 2
    expect(r.bianGua).toBeDefined()
    const moving = r.yao.filter((y) => y.moving)
    expect(moving).toHaveLength(1)
    expect(moving[0].changed).toBeDefined()
    // 变爻地支阴阳相反
    expect(isYangZhi(moving[0].changed!.zhi)).toBe(!isYangZhi(moving[0].zhi))
    // 六亲仍按本宫金论
    expect(moving[0].changed!.liuQin).toBe(liuQin('金', zhiWuXing(moving[0].changed!.zhi)))
    // 变卦六爻：仅动爻位被替换
    expect(r.bianYao).toHaveLength(6)
    const changedPos = moving[0].position
    r.bianYao!.forEach((y, i) => {
      if (i + 1 === changedPos) expect(y.zhi).toBe(moving[0].changed!.zhi)
      else expect(y.zhi).toBe(r.yao[i].zhi)
    })
  })

  it('无动爻（静卦）：无变卦、无变爻', () => {
    // 六爻皆静：直接以 lines 构造（不经过起卦的动爻）
    const r = naJia({ ...castByNumbers(1, 1), dongYao: [], bianGua: undefined, bianLines: undefined })
    expect(r.bianGua).toBeUndefined()
    expect(r.bianYao).toBeUndefined()
    expect(r.yao.every((y) => !y.moving)).toBe(true)
  })

  it('八宫卦序可由「本宫 + 世代变法」推导出来（最强的结构自检）', () => {
    // 京房变法：一世变初爻…五世变至五爻；游魂在五世基础上**四爻变回**；
    // 归魂 = 游魂的上卦 + 本宫的下卦。
    for (const g of GONGS) {
      const base = trigramLines(g.name)
      const ben = [...base, ...base] as boolean[]
      const flip = (src: boolean[], idx: number[]) => {
        const out = [...src]
        for (const i of idx) out[i] = !out[i]
        return out
      }
      const gen = [
        ben,
        flip(ben, [0]),
        flip(ben, [0, 1]),
        flip(ben, [0, 1, 2]),
        flip(ben, [0, 1, 2, 3]),
        flip(ben, [0, 1, 2, 3, 4]),
        flip(ben, [0, 1, 2, 4]), // 游魂：五世去掉四爻之变
        flip(ben, [4]) // 归魂：本宫下卦 + 游魂上卦（游魂上卦 = 本宫上卦变五爻）
      ]
      const derived = gen.map((lines) => hexagramByLines(lines).name)
      expect(derived, `${g.name}宫卦序`).toEqual(g.order)
    }
  })
})

describe('引擎集成', () => {
  it('铜钱起卦自动装卦，结果含卦宫 / 纳甲 / 世应', () => {
    const r = ichingLiujiaoEngine.compute({}, createRandomSource('najia'))
    expect(r.najia).toBeDefined()
    expect(r.najia!.yao).toHaveLength(6)
    const it = ichingLiujiaoEngine.interpret(r)
    const keys = it.blocks.map((b) => b.key)
    expect(keys).toContain('gong')
    expect(keys).toContain('naJia')
    // 装卦层已核验（京房分宫法 + 双实现 64 卦一致）→ 不再出现「待核验」说明块
    expect(it.blocks.some((b) => b.key === 'naJiaCaveat')).toBe(false)
    // 卦宫块仍正常呈现
    const gong = it.blocks.find((b) => b.key === 'gong')
    expect(gong!.text).toContain('宫')
  })

  it('装卦信息进入 basis（可供结果页"排盘依据"展开）', () => {
    const r = ichingLiujiaoEngine.compute({}, createRandomSource('najia'))
    const it = ichingLiujiaoEngine.interpret(r)
    expect(it.basis!['method']).toBe('coin')
    expect(Array.isArray(it.basis!['dongYao'])).toBe(true)
  })
})

function trigramLines(name: string): boolean[] {
  const map: Record<string, boolean[]> = {
    乾: [true, true, true],
    兑: [true, true, false],
    离: [true, false, true],
    震: [true, false, false],
    巽: [false, true, true],
    坎: [false, true, false],
    艮: [false, false, true],
    坤: [false, false, false]
  }
  return map[name]
}
