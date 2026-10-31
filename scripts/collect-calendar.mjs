// 历法 golden 采集（第二源）：lunisolar@2.6.0（非同源 6tail）+ NOAA EoT（天文级）
// 引擎 solarToLunar/fourPillars 底层 = lunar-typescript(6tail)，此处直接复算作为"引擎值"，
// 再用 lunisolar 独立复算交叉；trueSolarTime 用 NOAA 太阳位置算法复算 EoT。
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import Lunisolar from 'lunisolar'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const { Solar } = require(resolve(here, '../node_modules/lunar-typescript'))

const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
const pill = (p) => GAN[p.stem.value] + ZHI[p.branch.value]

// ---- 引擎等价（6tail）----
function tailSolarToLunar(y, m, d) {
  const l = Solar.fromYmdHms(y, m, d, 12, 0, 0).getLunar()
  return { month: l.getMonth(), day: l.getDay(), yearGanZhi: l.getYearInGanZhi() }
}
function tailFourPillars(y, m, d, h, mi, sect) {
  const ec = Solar.fromYmdHms(y, m, d, h, mi, 0).getLunar().getEightChar()
  ec.setSect(sect)
  return { year: ec.getYear(), month: ec.getMonth(), day: ec.getDay(), time: ec.getTime() }
}

// ---- 非同源 lunisolar ----
function lunSolarToLunar(y, m, d) {
  const ls = Lunisolar(`${y}-${m}-${d} 12:0`)
  const L = ls.lunar
  const leap = L.month > 100
  const month = leap ? L.month - 100 : L.month
  const yearGanZhi = pill(ls.char8._list[0])
  return { month, day: L.day, yearGanZhi, isLeap: leap }
}
function lunPillars(y, m, d, h, mi) {
  const ls = Lunisolar(`${y}-${m}-${d} ${h}:${mi}`)
  const list = ls.char8._list
  return { year: pill(list[0]), month: pill(list[1]), day: pill(list[2]), time: pill(list[3]) }
}

// ---- NOAA 天文级 EoT（与引擎 Spencer 近似式异源）----
function noaaEoT(date) {
  const jd = date.getTime() / 86400000 + 2440587.5
  const n = jd - 2451545.0
  const g = (283.0 + 0.9856 * n) * Math.PI / 180
  const lambda = (282.9 + 0.9856 * n) * Math.PI / 180
  const epsilon = 23.45 * Math.PI / 180
  const decl = Math.asin(Math.sin(epsilon) * Math.sin(lambda))
  const E = 1440 * (lambda - g - Math.atan2(Math.cos(decl) * Math.sin(g - lambda), Math.cos(g - lambda))) / Math.PI
  return E
}
function engEoT(date) {
  const start = Date.UTC(date.getFullYear(), 0, 1)
  const doy = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - start) / 86400000) + 1
  const B = (2 * Math.PI * (doy - 81)) / 364
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B)
}

const cases = [
  { id: 'calendar-009', m: 'solarToLunar', t: [2023, 3, 22] },
  { id: 'calendar-010', m: 'solarToLunar', t: [2025, 7, 25] },
  { id: 'calendar-017', m: 'solarToLunar', t: [1900, 1, 31] },
  { id: 'calendar-018', m: 'solarToLunar', t: [2100, 12, 31] },
  { id: 'calendar-020', m: 'solarToLunar', t: [1986, 6, 15] },
  { id: 'calendar-011', m: 'fourPillars', t: [2024, 2, 4, 16, 20], sect: 2 },
  { id: 'calendar-012', m: 'fourPillars', t: [2024, 2, 4, 16, 40], sect: 2 },
  { id: 'calendar-013', m: 'fourPillars', t: [2000, 6, 15, 23, 30], sect: 2 },
  { id: 'calendar-014', m: 'fourPillars', t: [2000, 6, 15, 23, 30], sect: 1 },
  { id: 'calendar-015', m: 'trueSolarTime', t: [2024, 6, 15, 12, 0], lon: 113.26 },
  { id: 'calendar-016', m: 'trueSolarTime', t: [2024, 6, 15, 12, 0], lon: 87.62 }
]

for (const c of cases) {
  console.log(`\n===== ${c.id} [${c.m}] input=${JSON.stringify(c.t)}${c.lon ? ' lon=' + c.lon : ''}`)
  if (c.m === 'solarToLunar') {
    const [y, m, d] = c.t
    const e = tailSolarToLunar(y, m, d)
    let l = null
    try { l = lunSolarToLunar(y, m, d) } catch (err) { console.log(`  lunisolar   = (越界不可用: ${err.message})`) }
    const ok = l && e.month === -l.month && e.day === l.day && e.yearGanZhi === l.yearGanZhi
    console.log(`  引擎(6tail) = 月${e.month} 日${e.day} ${e.yearGanZhi} (负=闰)`)
    if (l) console.log(`  lunisolar   = 月${l.month}(闰${l.isLeap}) 日${l.day} ${l.yearGanZhi}`)
    if (l) console.log(`  一致? ${ok ? 'TRUE' : 'FALSE'}  (引擎闰月以负月表示)`)
  } else if (c.m === 'fourPillars') {
    const [y, m, d, h, mi] = c.t
    const e = tailFourPillars(y, m, d, h, mi, c.sect)
    const l = lunPillars(y, m, d, h, mi)
    console.log(`  引擎(6tail sect=${c.sect}) = ${e.year}/${e.month}/${e.day}/${e.time}`)
    console.log(`  lunisolar(default)        = ${l.year}/${l.month}/${l.day}/${l.time}`)
    if (h >= 23) {
      const lNext = lunPillars(y, m, d + 1, 0, mi)
      console.log(`  lunisolar(次日00:${mi})     = ${lNext.year}/${lNext.month}/${lNext.day}/${lNext.time}  (供晚子时口径参考)`)
    }
  } else if (c.m === 'trueSolarTime') {
    const [y, m, d, h, mi] = c.t
    const lon = c.lon
    const longitudeMinutes = (lon - 120) * 4
    const date = new Date(y, m - 1, d, h, mi, 0)
    const eotEng = engEoT(date)
    const eotNoaa = noaaEoT(date)
    const totalEng = Math.round((longitudeMinutes + eotEng) * 10) / 10
    console.log(`  经度订正 = ${longitudeMinutes} 分`)
    console.log(`  EoT 引擎(Spencer) = ${eotEng.toFixed(3)}   NOAA = ${eotNoaa.toFixed(3)}   Δ=${(eotEng - eotNoaa).toFixed(3)}`)
    console.log(`  合计(totalMinutes) 引擎 = ${totalEng.toFixed(1)}`)
  }
}
