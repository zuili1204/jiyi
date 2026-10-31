// golden 采集（第一源）：iztro 2.6.1（MIT）紫微斗数 —— 含**辅曜 / 煞曜**
//
// 背景：`DOCS/iztro-main/iztro-main/ziwei-dump-full.json` 里的 `minor` 是空数组，
// 因为原 dump 脚本从 `palaces[].majorStars` 里过滤 `type !== 'major'`；
// 而 iztro 把辅曜 / 煞曜放在 `palaces[].minorStars`。本脚本直接读该字段，
// 以补齐 ziwei-009（辅曜煞曜）缺失的第二源。
//
// 用法：node scripts/collect-ziwei-iztro.mjs
//   只打印，不写文件；入库由人工逐条 diff 后手填。

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const { astro } = require(resolve(here, '../DOCS/iztro-main/iztro-main/lib/index.js'))

/** 与 golden 用例对齐（时辰索引：0 早子 … 12 晚子） */
const RUNS = [
  { id: 'ziwei-009', fn: () => astro.byLunar('1988-8-8', 4, '男', false, false, 'zh-CN') },
  { id: 'ziwei-001', fn: () => astro.byLunar('1984-2-5', 5, '男', false, false, 'zh-CN') }
]

for (const r of RUNS) {
  const a = r.fn()
  const stars = []
  for (const p of a.palaces ?? []) {
    for (const s of p.minorStars ?? []) {
      stars.push({ palace: p.earthlyBranch, name: s.name, type: s.type })
    }
  }
  const byType = {}
  for (const s of stars) byType[s.type] = (byType[s.type] ?? 0) + 1
  console.log(`===== ${r.id} =====`)
  console.log('  命宫:', a.earthlyBranchOfSoulPalace, '| 五行局:', a.fiveElementsClass)
  console.log('  辅曜煞曜（iztro minorStars）:', stars.map((s) => `${s.palace}:${s.name}`).join(' '))
  console.log('  类型分布:', JSON.stringify(byType))
}
