// 签诗母版采集管线（JY-04 内容闸 §3：采集可追溯）
//
// 用途：从权威互联网来源拉取观音灵签原始数据并落盘到
//       src/data/content/lots/guanyin.raw.json，供运行时内容包读取。
// 运行：node scripts/collect-lots.mjs
// 说明：本脚本只负责「采集 + 落盘」；字段映射与出处标注在
//       src/data/content/lots/index.ts 完成，便于审计与替换来源。

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '../src/data/content/lots/guanyin.raw.json')

// 来源（标称《百事问观音》通行本，中国寺庙标准版，人工校对）
const SOURCE_URL =
  'https://raw.githubusercontent.com/yanxinyu777-beep/guanyin-lingqian-100/main/guanyin-lots.json'

async function main() {
  console.log(`[collect-lots] 拉取: ${SOURCE_URL}`)
  const res = await fetch(SOURCE_URL, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  const data = await res.json()

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('返回数据非预期：应为非空数组')
  }
  // 基本结构校验（不在这里做语义清洗）
  const bad = data.find(
    (d) => typeof d.number !== 'number' || !Array.isArray(d.poem) || typeof d.interpretation !== 'string'
  )
  if (bad) throw new Error(`数据结构异常：${JSON.stringify(bad).slice(0, 120)}`)

  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify(data, null, 2) + '\n', 'utf8')
  console.log(`[collect-lots] 已写入 ${data.length} 签 -> ${OUT}`)
  console.log('[collect-lots] 记得在 src/data/content/lots/index.ts 核对 source / license，并安排 golden 核验 (Y0-03)。')
}

main().catch((e) => {
  console.error('[collect-lots] 失败:', e.message)
  process.exit(1)
})
