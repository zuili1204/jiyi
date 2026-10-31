// golden 采集（第二独立源）：taibu-core@3.5.0（MIT）梅花易数
//
// 纪律（DOCS/golden/README.md / JY-02 §5）：
//   期望值不得由本项目引擎反推；须两个独立来源一致方可入库。
//   本地 lunar-typescript / lunar-javascript / lunar-lite 同属 6tail 一系，**不构成独立源**，
//   故「时间起卦」这类依赖历法的用例，本脚本只能作为第二源，第一源须是典籍公式 + 权威农历日期。
//
// 用法：node scripts/collect-meihua-golden.mjs [--full]
//   默认打印对齐字段；--full 打印完整输出（用于确认字段名）。只打印，不写文件。

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const taibu = require(resolve(here, '../DOCS/taibu-master/packages/core/dist/index.js'))

const FULL = process.argv.includes('--full')

/** 与 DOCS/golden/meihua.json 的 5 条用例一一对应（date 为必填，数字/字数起卦不受其影响） */
const CASES = [
  { id: 'meihua-001', input: { question: '梅花 golden 采集', method: 'time', date: '2024-02-10T12:00' } },
  { id: 'meihua-002', input: { question: '梅花 golden 采集', method: 'time', date: '2024-08-08T08:00' } },
  // ⚠️ number_pair 在 taibu 中是「现代报数扩展法」，其 self-declared warning 明确
  //    「不属于《梅花易数》原典主线」——它直接按数取卦、**不 mod 8**，
  //    因此对「余数为 0 边界」这类原典口径用例**不能充当第二独立源**（会掩盖 mod 逻辑错误）。
  //    采集后仅作参考，不足以入库；入库需原典口径的第二源。
  { id: 'meihua-003', input: { question: '梅花 golden 采集', method: 'number_pair', date: '2024-02-10T12:00', numbers: [8, 8] } },
  { id: 'meihua-004', input: { question: '梅花 golden 采集', method: 'text_split', date: '2024-02-10T12:00', text: '稽疑', textSplitMode: 'count' } },
  { id: 'meihua-005', input: { question: '梅花 golden 采集', method: 'number_pair', date: '2024-02-10T12:00', numbers: [6, 6] } }
]

/** 从「卦盘」/「体用分析」块里抽出与 golden expect 对齐的字段 */
function pick(j) {
  const pan = j['卦盘'] ?? {}
  const ben = pan['本卦'] ?? {}
  return {
    benGua: ben['卦名'] ?? '',
    shangGua: ben['上卦'] ?? '',
    xiaGua: ben['下卦'] ?? '',
    dongYao: pan['动爻'] ?? null,
    huGua: pan['互卦']?.['卦名'] ?? '',
    bianGua: pan['变卦']?.['卦名'] ?? '',
    ti: pan['体卦']?.['卦名'] ?? '',
    yong: pan['用卦']?.['卦名'] ?? '',
    relation: j['体用分析']?.['关系'] ?? ''
  }
}

for (const c of CASES) {
  const out = taibu.calculateMeihua(c.input)
  const json = taibu.toMeihuaJson ? taibu.toMeihuaJson(out) : out
  console.log('=====', c.id, '=====')
  if (FULL) {
    console.log(JSON.stringify(json, null, 2))
  } else {
    console.log(JSON.stringify(pick(json), null, 2))
  }
}
