// 批量填充 384 爻白话（baiHua）
//
// 纪律（JY-04 / Y-后续规划 §4）：
//   - 白话是**对经文的今译与通行义理解说**，不得添加原典所无的吉凶断言与具体应验；
//   - 只改母版 `DOCS/content/iching/lines.json`，随后须跑 `npm run content:sync` 回写 src；
//   - 改完须跑 `npm test`（`content-gate.spec.ts` 与 `iching-lines.spec.ts` 把关）。
//
// 用法：node scripts/fill-baihua-batch.mjs DOCS/content/iching/baihua-batch-02.json
//   批次数据独立成文件，便于留痕与审校；脚本只做「按 id 填充」，不生成文本。

import { readFile, writeFile } from 'node:fs/promises'

const batchFile = process.argv[2]
if (!batchFile) {
  console.error('用法：node scripts/fill-baihua-batch.mjs <批次数据文件>')
  process.exit(1)
}

const TARGET = 'DOCS/content/iching/lines.json'
const BATCH = JSON.parse(await readFile(batchFile, 'utf8'))
const data = JSON.parse(await readFile(TARGET, 'utf8'))

let filled = 0
let skipped = 0
const missing = []
for (const [id, text] of Object.entries(BATCH)) {
  const hit = data.items.find((it) => it.id === id)
  if (!hit) {
    missing.push(id)
    continue
  }
  if (hit.baiHua && hit.baiHua.trim()) {
    skipped += 1
    continue
  }
  hit.baiHua = text
  filled += 1
}

const empty = data.items.filter((it) => !it.baiHua || !it.baiHua.trim()).length
await writeFile(TARGET, JSON.stringify(data, null, 2) + '\n', 'utf8')

console.log(`批次 ${batchFile}：填充 ${filled} / 跳过（已有） ${skipped}；缺失 id：${missing.join(', ') || '无'}`)
console.log(`剩余空缺：${empty} / ${data.items.length}`)
