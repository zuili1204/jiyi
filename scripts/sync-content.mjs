#!/usr/bin/env node
/**
 * 母版 → 产物 单向同步 + 内容闸（JY-04 §3 / JY-01 §6）
 *
 *   DOCS/content/** (母版，唯一人工编辑处)
 *        └─ npm run content:sync ─▶ src/data/content/** (产物，不手改)
 *
 * 闸规则（JY-04 §3.1）：① 合规词  ② 覆盖率  ③ 长度  ④ 结构  ⑤ 叠词与占位
 * 不过闸 exit 1，npm run build 直接失败。
 *
 * 说明：
 * - 本工作区中规划文档位于 DOCS/，内容母版位于 DOCS/content/（Windows 下 docs 与 DOCS
 *   同名，故复用现有 DOCS 目录，见 JY-03 §3 的目录约定偏差说明）。
 * - 词表与豁免规则读 `src/engine/compliance.rules.json`（唯一权威源）。早期版本在脚本内
 *   另存一份词表，导致两处漂移，已合并（R3）。
 * - **产物目录不清空**：只删除上一次生成的清单内文件（`.sync-manifest.json`），
 *   避免误删 `bootstrap.ts` / `index.ts` 等源码。
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MASTER_DIR = join(ROOT, 'DOCS', 'content')
const OUT_DIR = join(ROOT, 'src', 'data', 'content')
const RULES_FILE = join(ROOT, 'src', 'engine', 'compliance.rules.json')
const MANIFEST_FILE = join(OUT_DIR, '.sync-manifest.json')

// 发布仓库不提供 DOCS/content（内容母版只存在于本地工作区）。
// 缺母版时明确提示并跳过，不重写已入库的 src/data/content 快照。
if (!existsSync(MASTER_DIR)) {
  console.warn(
    '[content:sync] 未提供 DOCS/content（发布仓库不包含内容母版），本次跳过内容闸；' +
      'src/data/content 继续使用已入库的同步快照。'
  )
  process.exit(0)
}

/** 品类 → kind 映射（JY-01 §1.1） */
const DIR_TO_KIND = {
  lots: 'lots',
  iching: 'iching',
  qimen: 'qimen',
  ziwei: 'ziwei',
  bazi: 'bazi',
  tutorial: 'tutorial'
}

const rules = JSON.parse(readFileSync(RULES_FILE, 'utf8'))
const FAMILIES = rules.families
const PLACEHOLDERS = rules.placeholders
const REDUP = new RegExp(rules.reduplicationPattern)
const MAX_LEN = rules.maxTextLength
const LENGTH_OVERRIDES = rules.maxTextLengthOverrides ?? []
const EXEMPTIONS = rules.exemptions

const problems = { block: [], warn: [] }
const stats = { files: 0, items: 0, bytes: 0 }
const exemptAudit = { count: 0, byId: {} }

function normalizePath(p) {
  return p.replace(/\[\d+\]/g, '[*]')
}

function matchPathPattern(pattern, path) {
  const a = normalizePath(pattern).split('.')
  const b = normalizePath(path).split('.')
  if (a.length !== b.length) return false
  return a.every((seg, i) => seg === '*' || seg === b[i])
}

function findExemption(kind, path) {
  return EXEMPTIONS.find(
    (e) => (e.kind === '*' || e.kind === kind) && e.paths.some((p) => matchPathPattern(p, path))
  )
}

/** 长度阈值：默认 300 字；长篇原文字段（如解曰）走 override */
function lengthLimitFor(path) {
  for (const o of LENGTH_OVERRIDES) {
    if (o.paths.some((p) => matchPathPattern(p, path))) return o.max
  }
  return MAX_LEN
}

/** 被豁免路径的替代检查：占位 / 叠词 / 长度（JY-04 §3.4：豁免不等于关闸） */
function scanExemptText(text, path) {
  const hits = []
  for (const p of PLACEHOLDERS) {
    if (text.includes(p)) hits.push({ family: 'placeholder', word: p, path, level: 'block' })
  }
  if (REDUP.test(text)) hits.push({ family: 'reduplication', word: '叠词', path, level: 'block' })
  const limit = lengthLimitFor(path)
  if (text.length > limit) {
    hits.push({ family: 'length', word: `${text.length} 字（阈值 ${limit}）`, path, level: 'warn' })
  }
  return hits
}

function scanText(text, kind, path) {
  const ex = findExemption(kind, path)
  if (ex) {
    exemptAudit.count += 1
    exemptAudit.byId[ex.id] = (exemptAudit.byId[ex.id] ?? 0) + 1
    return scanExemptText(text, path)
  }
  const enabled = new Set(rules.familiesByKind[kind] ?? [])
  const hits = []
  for (const [family, def] of Object.entries(FAMILIES)) {
    if (!enabled.has(family)) continue
    for (const w of def.words) {
      if (text.includes(w)) hits.push({ family, word: w, path, level: def.level })
    }
  }
  for (const p of PLACEHOLDERS) {
    if (text.includes(p)) hits.push({ family: 'placeholder', word: p, path, level: 'block' })
  }
  if (REDUP.test(text)) hits.push({ family: 'reduplication', word: '叠词', path, level: 'block' })
  const limit = lengthLimitFor(path)
  if (text.length > limit) {
    hits.push({ family: 'length', word: `${text.length} 字（阈值 ${limit}）`, path, level: 'warn' })
  }
  return hits
}

function scanValue(value, kind, path = '') {
  const hits = []
  if (typeof value === 'string') return scanText(value, kind, path)
  if (Array.isArray(value)) {
    value.forEach((v, i) => hits.push(...scanValue(v, kind, `${path}[${i}]`)))
    return hits
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      hits.push(...scanValue(v, kind, path ? `${path}.${k}` : k))
    }
  }
  return hits
}

function checkStructure(json, kind, file) {
  // ④ 结构：version / source / license / school 必须齐全（JY-01 §6）
  const missing = ['version', 'source', 'license', 'school'].filter((k) => json[k] === undefined)
  if (missing.length) {
    problems.block.push({
      family: 'structure',
      word: `缺少字段 ${missing.join('/')}`,
      path: file,
      level: 'block'
    })
  }
  // ② 覆盖率：items 必须存在且 id 唯一
  if (Array.isArray(json.items)) {
    const ids = new Set()
    for (const it of json.items) {
      if (!it.id) {
        problems.block.push({ family: 'coverage', word: '条目缺 id', path: file, level: 'block' })
        continue
      }
      if (ids.has(it.id)) {
        problems.block.push({
          family: 'coverage',
          word: `id 重复：${it.id}`,
          path: file,
          level: 'block'
        })
      }
      ids.add(it.id)
      stats.items++
    }
  } else {
    problems.block.push({ family: 'coverage', word: '缺少 items 数组', path: file, level: 'block' })
  }
}

/** 溯源校验：母版声明了豁免字段，就必须同时声明 source / license / school */
function checkProvenance(json, kind, file) {
  const used = EXEMPTIONS.filter((e) => e.kind === '*' || e.kind === kind)
  if (!used.length) return
  const required = new Set(used.flatMap((e) => e.requires ?? []))
  for (const key of required) {
    const v = json[key]
    if (typeof v !== 'string' || v.trim() === '' || v.trim() === 'unknown') {
      problems.block.push({
        family: 'provenance',
        word: `母版声明了传统原文豁免，但缺少可追溯的 ${key}`,
        path: file,
        level: 'block'
      })
    }
  }
}

function walk(dir) {
  if (!existsSync(dir)) return []
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(p))
    // 以点开头的文件是采集缓存 / 本地中间产物，不是母版
    else if (entry.name.endsWith('.json') && !entry.name.startsWith('.')) out.push(p)
  }
  return out
}

/** 只清理上一次生成的产物，绝不整目录删除 */
function cleanGenerated() {
  if (!existsSync(MANIFEST_FILE)) return
  let list = []
  try {
    list = JSON.parse(readFileSync(MANIFEST_FILE, 'utf8'))
  } catch {
    list = []
  }
  for (const rel of list) {
    const p = join(OUT_DIR, rel)
    if (existsSync(p)) rmSync(p, { force: true })
  }
  rmSync(MANIFEST_FILE, { force: true })
}

function main() {
  if (!existsSync(MASTER_DIR)) {
    console.log(`[content:sync] 母版目录不存在：${MASTER_DIR}`)
    console.log('[content:sync] ❌ 无母版可同步：请先在 DOCS/content/ 建立内容母版')
    process.exit(1)
  }

  mkdirSync(OUT_DIR, { recursive: true })
  cleanGenerated()

  const generated = []

  for (const file of walk(MASTER_DIR)) {
    const rel = file.slice(MASTER_DIR.length + 1).replace(/\\/g, '/')
    const kind = DIR_TO_KIND[rel.split('/')[0]]
    if (!kind) {
      problems.block.push({ family: 'structure', word: `未知品类目录：${rel}`, path: file, level: 'block' })
      continue
    }

    const raw = readFileSync(file, 'utf8')
    stats.bytes += Buffer.byteLength(raw)
    let json
    try {
      json = JSON.parse(raw)
    } catch (e) {
      problems.block.push({ family: 'structure', word: `JSON 解析失败：${e.message}`, path: rel, level: 'block' })
      continue
    }

    checkStructure(json, kind, rel)
    checkProvenance(json, kind, rel)
    // 路径不含文件名前缀，保证豁免 pattern（items[*].poem[*]）可匹配；
    // 命中后再补上文件名，便于定位。
    for (const hit of scanValue(json, kind, '')) {
      const located = { ...hit, path: hit.path ? `${rel} → ${hit.path}` : rel }
      problems[located.level === 'block' ? 'block' : 'warn'].push(located)
    }

    const dest = join(OUT_DIR, rel)
    mkdirSync(dirname(dest), { recursive: true })
    // 产物：紧凑写入，不改内容
    writeFileSync(dest, JSON.stringify(json))
    generated.push(rel)
    stats.files++
  }

  writeFileSync(MANIFEST_FILE, JSON.stringify(generated, null, 2) + '\n')
  generated.push('.sync-manifest.json')

  writeFileSync(
    join(OUT_DIR, 'index.json'),
    JSON.stringify(
      {
        version: stats.files,
        kinds: Object.keys(DIR_TO_KIND),
        items: stats.items,
        bytes: stats.bytes,
        rulesVersion: rules.version
      },
      null,
      2
    ) + '\n'
  )
  generated.push('index.json')
  writeFileSync(MANIFEST_FILE, JSON.stringify(generated, null, 2) + '\n')

  const kb = (stats.bytes / 1024).toFixed(1)
  console.log(`[content:sync] 同步 ${stats.files} 个文件 / ${stats.items} 条 / ${kb} KB`)
  console.log(
    `[content:sync] 传统原文豁免命中 ${exemptAudit.count} 处` +
      (Object.keys(exemptAudit.byId).length
        ? `（${Object.entries(exemptAudit.byId)
            .map(([k, v]) => `${k}=${v}`)
            .join(', ')}）`
        : '') +
      `；替代检查：占位 / 叠词 / 长度 / 溯源 生效`
  )

  // 体积闸（JY-03 §11：≤ 1.5 MB）
  if (stats.bytes > 1.5 * 1024 * 1024) {
    problems.block.push({
      family: 'size',
      word: `内容体积 ${kb} KB 超出预算 1536 KB`,
      path: 'index.json',
      level: 'block'
    })
  }

  for (const w of problems.warn) console.warn(`[warn] ${w.family} 命中「${w.word}」@ ${w.path}`)
  for (const b of problems.block) console.error(`[block] ${b.family} 命中「${b.word}」@ ${b.path}`)

  if (problems.block.length > 0) {
    console.error(`\n❌ 内容闸未通过：${problems.block.length} block / ${problems.warn.length} warn`)
    process.exit(1)
  }
  console.log(`✅ 内容闸通过（0 block / ${problems.warn.length} warn）`)
}

main()
