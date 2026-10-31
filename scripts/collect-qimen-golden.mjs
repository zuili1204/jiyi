// golden 采集（第二源）：taibu-core@3.5.0（MIT）奇门遁甲
//
// 用法：node scripts/collect-qimen-golden.mjs
//   第一源 = 拆补法定局规则（典籍口径，**人工独立推导**，见 DOCS/golden/qimen.json 的 note）
//   第二源 = 本脚本（taibu-core 运行时，juMethod='chaibu'）
//   只打印，不写文件；入库由人工逐条 diff 后手填。
//
// ⚠️ 纪律：J6 已拍板**拆补法**；置闰 / 茅山用例不得与本批混用。

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const { calculateQimen, toQimenJson } = require(
  resolve(here, '../DOCS/taibu-master/packages/core/dist/index.js')
)

/** 与 DOCS/golden/qimen.json 的 5 条用例一一对应 */
const CASES = [
  { id: 'qimen-001', t: { year: 2024, month: 2, day: 10, hour: 12, minute: 0 }, note: '冬至后阳遁' },
  { id: 'qimen-002', t: { year: 2024, month: 6, day: 21, hour: 12, minute: 0 }, note: '夏至后阴遁' },
  { id: 'qimen-003', t: { year: 2024, month: 2, day: 4, hour: 17, minute: 0 }, note: '立春交节当日' },
  { id: 'qimen-004', t: { year: 2024, month: 3, day: 20, hour: 9, minute: 0 }, note: '值符值使/天地盘' },
  { id: 'qimen-005', t: { year: 2024, month: 9, day: 23, hour: 15, minute: 0 }, note: '九宫全盘/空亡马星' }
]

for (const c of CASES) {
  const o = await calculateQimen({ ...c.t, juMethod: 'chaibu', question: 'golden 采集' })
  const j = toQimenJson(o)
  const flat = JSON.stringify(j)
  // 从规范化 JSON 里抓关键字段（键名可能为中文，做容错匹配）
  const pick = (keys) => {
    for (const k of Object.keys(j)) {
      if (keys.some((x) => k.includes(x))) return j[k]
    }
    return undefined
  }
  console.log(`===== ${c.id}（${c.note}）=====`)
  console.log('  基本信息:', JSON.stringify(j['基本信息'], null, 1))
  const pan = j['九宫盘']
  if (Array.isArray(pan)) {
    console.log('  九宫盘[0]:', JSON.stringify(pan[0], null, 1))
    console.log('  九宫盘宫位数:', pan.length)
  } else if (pan) {
    console.log('  九宫盘键:', Object.keys(pan).join(' | '))
  }
  if (process.argv.includes('--full')) console.log(flat.slice(0, 3000))
}
