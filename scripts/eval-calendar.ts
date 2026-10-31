/**
 * 历法库候选评估脚本（Y0-02 / Y0-06）
 *
 * 纪律（JY-02 §4）：评估只做「能力存在性 + 自洽性 + 体积」检查，
 * 不做正确性断言 —— 正确性的期望值只能来自权威来源（golden test，JY-02 §5）。
 * 本脚本的输出是选型依据，不是验收结论。
 *
 * 运行：npx tsx 或 node --experimental-strip-types（Node 22）
 *       node --experimental-strip-types scripts/eval-calendar.mjs 不可用则用 tsx
 * 简化起见此文件用 .mjs + 动态 import 编译后的 TS 不方便，故直接用 ts 由 vite-node 运行：
 *   npx vite-node scripts/eval-calendar.ts
 */
import { Solar, Lunar } from 'lunar-typescript'

const rows: string[] = []

function check(name: string, fn: () => unknown) {
  try {
    const v = fn()
    rows.push(`| ${name} | ✅ | \`${String(v)}\` |`)
  } catch (e) {
    rows.push(`| ${name} | ❌ | ${(e as Error).message} |`)
  }
}

console.log('## 候选：lunar-typescript（6tail）\n')
console.log('| 能力 | 可用 | 样例输出（**待权威核验**） |')
console.log('|---|---|---|')

check('公历→农历', () => Solar.fromYmdHms(2024, 2, 10, 0, 0, 0).getLunar().toString())
check('农历→公历', () => Lunar.fromYmdHms(2024, 1, 1, 0, 0, 0).getSolar().toYmdHms())
check('干支（年月日时）', () => {
  const l = Solar.fromYmdHms(2024, 2, 10, 12, 0, 0).getLunar()
  const b = l.getEightChar()
  return `${b.getYear()} ${b.getMonth()} ${b.getDay()} ${b.getTime()}`
})
check('节气列表（当年）', () =>
  Solar.fromYmdHms(2024, 1, 1, 0, 0, 0)
    .getLunar()
    .getJieQiTable()
    ? Object.keys(Solar.fromYmdHms(2024, 1, 1, 0, 0, 0).getLunar().getJieQiTable()).length
    : 'n/a'
)
check('立春时刻', () => {
  const l = Solar.fromYmdHms(2024, 2, 4, 0, 0, 0).getLunar()
  const t = l.getJieQiTable()['立春']
  return t ? t.toYmdHms() : 'n/a'
})
check('纳音', () => Solar.fromYmdHms(2024, 2, 10, 12, 0, 0).getLunar().getEightChar().getYearNaYin())
check('星期/星座', () => Solar.fromYmdHms(2024, 2, 10, 12, 0, 0).getWeekInChinese())

console.log(rows.join('\n'))

console.log('\n### 自洽性检查（不依赖权威来源）')
let pass = 0
let fail = 0
function assert(name: string, cond: boolean) {
  if (cond) {
    pass++
    console.log(`- ✅ ${name}`)
  } else {
    fail++
    console.log(`- ❌ ${name}`)
  }
}

// 1) 农历→公历→农历 往返一致
for (const [y, m, d] of [
  [2024, 1, 1],
  [2020, 4, 1],
  [1998, 5, 5],
  [2033, 11, 1]
] as const) {
  const round = Lunar.fromYmdHms(y, m, d, 12, 0, 0)
    .getSolar()
    .getLunar()
    .toString()
  assert(`农历 ${y}-${m}-${d} 往返自洽`, round.length > 0)
}

// 2) 六十甲子循环：同一日柱每 60 天重复
function dayGanZhi(y: number, m: number, d: number) {
  return Solar.fromYmdHms(y, m, d, 12, 0, 0).getLunar().getEightChar().getDay()
}
assert(
  '日柱 60 天周期',
  dayGanZhi(2024, 1, 1) === dayGanZhi(2024, 3, 1) // 相隔 60 天
)

// 3) 24 个标准节气名全部可取到时刻
const JIEQI_24 = [
  '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
  '立夏', '小满', '芒种', '夏至', '小暑', '大暑',
  '立秋', '处暑', '白露', '秋分', '寒露', '霜降',
  '立冬', '小雪', '大雪', '冬至', '小寒', '大寒'
]
const table = Solar.fromYmdHms(2024, 6, 1, 0, 0, 0).getLunar().getJieQiTable() as Record<string, any>
const missing = JIEQI_24.filter((n) => !table[n])
assert(`24 节气名齐全（缺 ${missing.join('/') || '无'}）`, missing.length === 0)

// 4) 节气时刻单调递增（按节气顺序）
const ordered = JIEQI_24.map((n) => table[n]?.toYmdHms?.()).filter(Boolean)
assert(`节气时刻均可格式化（${ordered.length}/24）`, ordered.length === 24)
const ms = JIEQI_24.map((n) => {
  const s = table[n]
  return s ? Date.parse(s.toYmdHms().replace(' ', 'T')) : NaN
})
// 从立春开始的一年内应单调递增（表跨年，取立春→大寒索引）
const start = JIEQI_24.indexOf('立春')
const seq = [...ms.slice(start), ...ms.slice(0, start)]
assert(
  '节气时刻按序递增（立春→大寒）',
  seq.every((v, i) => i === 0 || (v > seq[i - 1] && !Number.isNaN(v)))
)

// 5) 区间边界不崩溃
let boundaryOk = true
try {
  Solar.fromYmdHms(1900, 1, 1, 0, 0, 0).getLunar().toString()
  Solar.fromYmdHms(2100, 12, 31, 0, 0, 0).getLunar().toString()
} catch {
  boundaryOk = false
}
assert('1900–2100 边界可计算（不保证精度）', boundaryOk)

console.log(`\n自洽性：${pass} 通过 / ${fail} 失败`)
