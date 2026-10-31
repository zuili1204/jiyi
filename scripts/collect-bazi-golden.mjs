// golden 采集（第二源）：lunisolar@2.6.0（零依赖、干支历自研，**非同源**于 6tail 系）
//
// 用法：node scripts/collect-bazi-golden.mjs
//   用法本源 = 引擎（src/engine/calendar 的 fourPillars，基于 lunar-typescript=6tail）
//   第二源 = lunisolar（本脚本独立复算），**不写文件**，入库由人工逐条 diff 后手填。
//
// ⚠️ YR25：lunar-typescript / taibu(lunar-javascript) / iztro(lunar-lite) 同为 6tail 一系，
//   互证不构成独立双源；lunisolar 零运行时依赖、历法自研，构成非同源第二日柱权威。
// ⚠️ lunisolar 以「东八区标准时」输入；农历用例仅用 lunar-typescript 做单位换算
//   （干支值仍由 lunisolar 独立出）；真太阳时用例（004/020）需先按经度订正，故默认跳过。

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import Lunisolar from 'lunisolar'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const { Solar, Lunar } = require(resolve(here, '../node_modules/lunar-typescript'))

const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

const pill = (p) => GAN[p.stem.value] + ZHI[p.branch.value]

/** 公历（东八区）时刻 → lunisolar 四柱 */
function lunisolarPillars(y, m, d, h, mi) {
  const ls = Lunisolar(`${y}-${m}-${d} ${h}:${mi}`)
  const list = ls.char8._list
  return { year: pill(list[0]), month: pill(list[1]), day: pill(list[2]), hour: pill(list[3]) }
}

/** 6tail 参照（仅用于显示口径差异，不构成权威） */
function tail6Pillars(y, m, d, h, mi, sect) {
  const ec = Solar.fromYmdHms(y, m, d, h, mi, 0).getLunar().getEightChar()
  ec.setSect(sect)
  return { year: ec.getYear(), month: ec.getMonth(), day: ec.getDay(), hour: ec.getTime() }
}

const cases = [
  { id: 'bazi-001', note: '立春交节前（1984 立春 23:18:44 权威时刻）', t: { y: 1984, m: 2, d: 4, h: 22, mi: 0 } },
  { id: 'bazi-002', note: '立春交节后', t: { y: 1984, m: 2, d: 5, h: 1, mi: 0 } },
  { id: 'bazi-003', note: '常规男命', t: { y: 1990, m: 6, d: 15, h: 10, mi: 0 } },
  { id: 'bazi-004', note: '真太阳时（跳过：需经度订正）', t: null },
  { id: 'bazi-005', note: '农历输入（庚午年五月廿三巳时）', lunar: { y: 1990, m: 5, d: 23, leap: false }, t: { h: 10, mi: 0 } },
  { id: 'bazi-006', note: '农历+闰月（癸卯闰二月初一辰时）', lunar: { y: 2023, m: 2, d: 1, leap: true }, t: { h: 8, mi: 0 } },
  { id: 'bazi-007', note: '早子时 0:30', t: { y: 2000, m: 1, d: 1, h: 0, mi: 30 } },
  { id: 'bazi-008', note: '晚子时 23:30（J7 A 归当日）', t: { y: 2000, m: 1, d: 1, h: 23, mi: 30 } },
  { id: 'bazi-009', note: '晚子时 23:30（J7 B 归次日）', t: { y: 2000, m: 1, d: 1, h: 23, mi: 30 } },
  { id: 'bazi-010', note: '年末+高纬', t: { y: 1976, m: 12, d: 31, h: 22, mi: 0 } },
  { id: 'bazi-020', note: '真太阳时（跳过）', t: null }
]

for (const c of cases) {
  if (!c.t && !c.lunar) {
    console.log(`\n===== ${c.id}（${c.note}）— SKIP`)
    continue
  }
  let y, m, d, h = 0, mi = 0
  if (c.lunar) {
    const l = Lunar.fromYmd(c.lunar.y, c.lunar.leap ? -c.lunar.m : c.lunar.m, c.lunar.d)
    const s = l.getSolar()
    y = s.getYear(); m = s.getMonth(); d = s.getDay(); h = c.t?.h ?? 12; mi = c.t?.mi ?? 0
    console.log(`\n===== ${c.id}（${c.note}） → 公历 ${y}-${m}-${d} ${h}:${mi}`)
  } else {
    ;({ y, m, d, h, mi } = c.t)
    console.log(`\n===== ${c.id}（${c.note}） 公历 ${y}-${m}-${d} ${h}:${mi}`)
  }
  const g = lunisolarPillars(y, m, d, h, mi)
  const t6 = tail6Pillars(y, m, d, h, mi, 2)
  const same = `${g.year}${g.month}${g.day}${g.hour}` === `${t6.year}${t6.month}${t6.day}${t6.hour}`
  console.log(`  lunisolar = ${g.year}/${g.month}/${g.day}/${g.hour}`)
  console.log(`  6tail(ref)  = ${t6.year}/${t6.month}/${t6.day}/${t6.hour}`)
  console.log(`  一致? ${same ? 'TRUE' : 'FALSE'}`)
}