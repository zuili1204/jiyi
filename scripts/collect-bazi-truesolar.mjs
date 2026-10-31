// 真太阳时独立订正源（golden 采集用，第二源校验）
//
// 真太阳时 = 本地时 + 经度订正 + 均时差(EoT)
//   - 经度订正 = (经度 − 120) × 4 分钟（东八区标准经度 120°E）
//   - EoT 用 **NOAA 天文算法**（基于儒略日 JD，太阳平黄经/真黄经/赤经），
//     与引擎 trueSolar.ts 的 Spencer 近似式（9.87sin2B − 7.53cosB − 1.5sinB）**算法异源**，
//     用于交叉验证「近似式 ±1 分钟」是否可接受。
//
// 用法：node scripts/collect-bazi-truesolar.mjs
//   对 004 / 020：
//     A. 引擎近似式（Spencer）订正 → usedAtS → lunisolar 四柱
//     B. NOAA 天文式订正 → usedAtN → lunisolar 四柱
//   若 A==B 四柱（±1min 内不应翻柱）→ 双源一致，可入库。

import Lunisolar from 'lunisolar'

const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
const pill = (p) => GAN[p.stem.value] + ZHI[p.branch.value]

// 公开经度表（东经，度）
const LON = { 乌鲁木齐: 87.68, 西安: 108.94, 北京: 116.4, 广州: 113.26, 郑州: 113.65, 成都: 104.07, 杭州: 120.15 }

// —— 引擎 Spencer 近似式（复刻 engine/calendar/trueSolar.ts，仅用于对照）——
function eotSpencer(date) {
  const start = Date.UTC(date.getFullYear(), 0, 1)
  const doy = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - start) / 86400000) + 1
  const B = (2 * Math.PI * (doy - 81)) / 364
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B)
}

// —— NOAA 天文级 EoT（独立算法，来源 NOAA Solar Calculation）——
function toJD(d) {
  return d.getTime() / 86400000 + 2440587.5
}
function eotNOAA(date) {
  const n = toJD(date) - 2451545.0
  const L = (280.46 + 0.9856474 * n) % 360 // 平黄经
  const g = ((357.528 + 0.9856003 * n) % 360) * Math.PI / 180 // 平近点角
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * Math.PI / 180 // 真黄经
  const eps = (23.439 - 0.00000036 * n) * Math.PI / 180
  const alpha = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)) * 180 / Math.PI // 赤经(度)
  let e = L - alpha
  while (e > 180) e -= 360
  while (e < -180) e += 360
  return e * 4 // 度→分钟
}

function correct(date, lon) {
  const lonMin = (lon - 120) * 4
  return { lonMin, spencer: eotSpencer(date), noaa: eotNOAA(date), lon }
}

function pillarsAt(dateStr) {
  const ls = Lunisolar(dateStr)
  const list = ls.char8._list
  return `${pill(list[0])}/${pill(list[1])}/${pill(list[2])}/${pill(list[3])}`
}

function addMin(date, min) {
  return new Date(date.getTime() + min * 60000)
}
function toStr(date) {
  const p = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`
}

const cases = [
  { id: 'bazi-004', place: '乌鲁木齐', y: 1990, m: 6, d: 15, h: 10, mi: 0 },
  { id: 'bazi-020', place: '西安', y: 1950, m: 3, d: 1, h: 12, mi: 0 }
]

for (const c of cases) {
  const base = new Date(c.y, c.m - 1, c.d, c.h, c.mi)
  const corr = correct(base, LON[c.place])
  const spencerTotal = Math.round((corr.lonMin + corr.spencer) * 10) / 10
  const noaaTotal = Math.round((corr.lonMin + corr.noaa) * 10) / 10
  const usedS = addMin(base, spencerTotal)
  const usedN = addMin(base, noaaTotal)
  const ps = pillarsAt(toStr(usedS))
  const pn = pillarsAt(toStr(usedN))
  console.log(`\n===== ${c.id}（${c.place} ${c.y}-${c.m}-${c.d} ${c.h}:${c.mi}）`)
  console.log(`  经度订正 = ${corr.lonMin.toFixed(1)} 分`)
  console.log(`  EoT：Spencer=${corr.spencer.toFixed(2)}  NOAA=${corr.noaa.toFixed(2)}  (Δ=${(corr.noaa - corr.spencer).toFixed(2)})`)
  console.log(`  合计订正：Spencer=${spencerTotal}  NOAA=${noaaTotal}  (Δ=${(noaaTotal - spencerTotal).toFixed(1)})`)
  console.log(`  订正后：Spencer=${toStr(usedS)}   NOAA=${toStr(usedN)}`)
  console.log(`  lunisolar 四柱：Spencer=${ps}   NOAA=${pn}`)
  console.log(`  双源一致? ${ps === pn ? 'TRUE（可入库）' : 'FALSE（Δ≥1min 翻柱，需人工）'}`)
}
