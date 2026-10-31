import { describe, it, expect } from 'vitest'
import { dingJu } from '@/engine/qimen'

/**
 * 《奇门旨归·占验课》25 例 → 定局「对账」（Y6-final 诊断稿）
 *
 * 把 z-anchor 唯一锚定的公历 + 原文时辰喂 `dingJu`，统计引擎定局与原文标称的
 * 逐例一致率。**当前是诊断态，不是「翻 reviewed」的依据**：
 *
 * 实测（1853–1892 窗口）：
 * - 25 例全部能定出局（节气/三元/局数链路不崩）；
 * - 原文**有局数**者（22 例）中，ju 与原文一致 **11** 例；
 * - 不一致者呈 **±3 / ±6 的「整元偏移」**（如 Z11 引擎1 vs 原文7），提示
 *   「三元归属」取法差异：本仓库 `sanYuan` 采【拆补·日支】（子午卯酉/…
 *   见 sanYuanRule），而原文疑走另一流派（符头/置闰或他法）—— 属流派口径差异，
 *   不能据此改写母版硬凑，也不能翻 `reviewed`；
 * - Z10/Z23 的【日柱】引擎亦与誊录不同（癸卯 vs 甲戌 / 甲戌 vs 己卯）：
 *   誊录日柱与「年干支+农历月日→公历」派生日柱冲突，归入「待版次对校」。
 *
 * 结论：保持 `dingJu.json.reviewed = false`，如实标注「未过权威核校」；
 * 本 spec 只做对账与留档，不因流派差异强行断言通过（不把「对不齐」藏掉）。
 */
type Sz = '子'|'丑'|'寅'|'卯'|'辰'|'巳'|'午'|'未'|'申'|'酉'|'戌'|'亥'
const HOUR_OF: Record<Sz, number> = { 子:0,丑:2,寅:4,卯:6,辰:8,巳:10,午:12,未:14,申:16,酉:18,戌:20,亥:22 }

interface V {
  id: string
  s: [number, number, number]
  sz: Sz
  dayGZ: string
  dun: 'yang' | 'yin'
  ju: number | null
  note: string
}

const V: V[] = [
  { id:'Z01', s:[1853,10,5],  sz:'申', dayGZ:'乙巳', dun:'yin',  ju:4,  note:'咸丰癸丑九月初三·阴四' },
  { id:'Z02', s:[1855,6,22],  sz:'辰', dayGZ:'庚午',   dun:'yang', ju:3,  note:'乙卯五月初九·阳三' },
  { id:'Z03', s:[1876,1,13],  sz:'巳', dayGZ:'庚辰',  dun:'yang', ju:2,  note:'光绪乙亥十二月十七·阳二' },
  { id:'Z04', s:[1876,2,8],   sz:'申', dayGZ:'丙午',   dun:'yang', ju:2,  note:'丙子正月十四·阳二' },
  { id:'Z05', s:[1876,2,15],  sz:'卯', dayGZ:'癸丑',  dun:'yang', ju:null, note:'丙子正月廿一·缺局' },
  { id:'Z06', s:[1876,2,16],  sz:'酉', dayGZ:'甲寅',  dun:'yang', ju:5,   note:'丙子正月廿二·阳五' },
  { id:'Z07', s:[1884,4,28],  sz:'辰', dayGZ:'戊申', dun:'yang', ju:8,  note:'甲申四月初四·阳八' },
  { id:'Z08', s:[1884,4,28],  sz:'卯', dayGZ:'戊申', dun:'yang', ju:null, note:'甲申四月初四卯·缺局' },
  { id:'Z09', s:[1884,4,26],  sz:'辰', dayGZ:'丙午', dun:'yang', ju:null, note:'甲申四月初二·缺局' },
  { id:'Z10', s:[1884,12,19], sz:'申', dayGZ:'甲戌', dun:'yin',  ju:3,  note:'甲申十月廿三·阴三' },
  { id:'Z11', s:[1885,3,16],  sz:'酉', dayGZ:'庚午', dun:'yang', ju:7,  note:'乙酉正月三十·阳七' },
  { id:'Z12', s:[1885,3,19],  sz:'午', dayGZ:'癸酉', dun:'yang', ju:7,  note:'乙酉二月初三·阳七' },
  { id:'Z13', s:[1886,10,13], sz:'午', dayGZ:'丙午', dun:'yin',  ju:3,  note:'丙戌九月十六·阴三' },
  { id:'Z14', s:[1887,5,9],   sz:'巳', dayGZ:'甲戌', dun:'yang', ju:7,  note:'丁亥四月十七·阳七' },
  { id:'Z15', s:[1887,5,30],  sz:'巳', dayGZ:'乙未', dun:'yang', ju:5,  note:'丁亥闰四月初八·阳五' },
  { id:'Z16', s:[1888,10,7],  sz:'酉', dayGZ:'辛亥', dun:'yin',  ju:7,  note:'戊子九月初三·阴七' },
  { id:'Z17', s:[1888,10,11], sz:'戌', dayGZ:'乙卯', dun:'yin',  ju:9,   note:'己子九月初七·阴九' },
  { id:'Z18', s:[1889,4,6],   sz:'巳', dayGZ:'壬子', dun:'yang', ju:4,  note:'己丑三月初七·阳四' },
  { id:'Z19', s:[1890,11,12], sz:'辰', dayGZ:'丁酉', dun:'yin',  ju:6,  note:'庚寅十月初一·阴六' },
  { id:'Z20', s:[1891,1,13],  sz:'辰', dayGZ:'己亥', dun:'yang', ju:8,  note:'庚寅十二月十四·阳八' },
  { id:'Z21', s:[1892,8,28],  sz:'酉', dayGZ:'壬辰', dun:'yin',  ju:7,  note:'壬辰七月初七·阴七' },
  { id:'Z22', s:[1892,8,30],  sz:'卯', dayGZ:'甲午', dun:'yin',  ju:1,   note:'壬辰七月初九·阴一' },
  { id:'Z23', s:[1885,9,16],  sz:'辰', dayGZ:'己卯', dun:'yin',  ju:9,   note:'己酉八月初八·阴九' },
  { id:'Z24', s:[1885,5,4],   sz:'未', dayGZ:'己未', dun:'yang', ju:8,  note:'己酉三月二十·阳八' },
  { id:'Z25', s:[1880,10,17], sz:'寅', dayGZ:'己卯', dun:'yin',  ju:3,  note:'光绪庚辰九月十四·阴三' }
]

describe('《占验课》25 局对账（诊断，不翻 substituted）', () => {
  it('逐例对账并汇总一致率（打印，不硬锁）', () => {
    let juYes = 0, juNo = 0, juN = 0
    const diffs: string[] = []
    for (const c of V) {
      const [y, m, d] = c.s
      const r = dingJu({ year: y, month: m, day: d, hour: HOUR_OF[c.sz], minute: 0 })
      expect(r, `${c.id}: 应能定出局`).toBeDefined()

      // 日柱
      const dayMatch = r!.dayGanZhi === c.dayGZ

      if (c.ju !== null) {
        juN++
        if (r!.ju === c.ju) juYes++
        else {
          juNo++
          diffs.push(`${c.id} ${c.note} 引${r!.ju} vs 原${c.ju}（Δ${r!.ju - c.ju}）`)
        }
      }
      const juTxt = c.ju === null ? '-' : `${r!.ju}${r!.ju === c.ju ? '✓' : '✗'}`
      console.log(
        `[${c.id}] ${c.note.padEnd(16)} | 节=${r!.term} ${r!.dun==='yang'?'阳':'阴'}${r!.yuan[0]} 局${juTxt.padEnd(4)} 日柱=${r!.dayGanZhi}${dayMatch?'✓':'✗(誊${r!.dayGanZhi} vs ${c.dayGZ})'}`
      )
    }
    console.log('---')
    console.log(`有局数对照: ${juYes}/${juN}（缺局 ${V.length - juN} 例）`)
    if (diffs.length) console.log('不一致明细:\n' + diffs.join('\n'))
    // 大于 0 即链路可用；不做「对上」假断言
    expect(juN).toBeGreaterThan(0)
  })
})