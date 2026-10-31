#!/usr/bin/env node
/**
 * 采集六十四卦爻辞（Y3-02）
 *
 *   github.com/freizl/yijing  zh-CN/64gua.json（MIT）
 *        └─ node scripts/collect-iching.mjs ─▶ DOCS/content/iching/lines.json（母版）
 *
 * 数据集字段：id（下卦三爻 + 上卦三爻，1=阳，自下而上）/ name / gua_ci / tuan_ci /
 *             da_xiang / yao_ci[] / xiao_xiang[] / symbol
 *
 * 纪律：
 * - 只采**古籍原文**（爻辞 / 小象），白话（baiHua）一律**自撰**，采集脚本不生成、不臆造；
 *   本轮白话留空并统计空缺，待内容侧补齐。
 * - 采集完必须跑 `npm run content:sync` 过闸；母版是唯一人工编辑处。
 * - 同时输出「卦辞 / 大象」与现有 hexagrams.json 的差异，供交叉核对（两个来源一致才可信）。
 */
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'DOCS', 'content', 'iching')
const SRC_URL =
  'https://raw.githubusercontent.com/freizl/yijing/main/zh-CN/64gua.json'
// 缓存**不能**放在 DOCS/content 下：那会被 content:sync 当成母版
const LOCAL_CACHE = join(ROOT, 'scripts', '.cache', '64gua.json')

const YAO_TITLE = ['初', '二', '三', '四', '五', '上']

/** 数据集卦名与本产品卦表（文王序）的异体字对齐 */
const NAME_FIX = { 遯: '遁' }

async function loadSource() {
  // 优先用本地缓存（`--cache` 时离线重跑），否则联网采集
  if (process.argv.includes('--cache') && existsSync(LOCAL_CACHE)) {
    return JSON.parse(readFileSync(LOCAL_CACHE, 'utf8'))
  }
  const res = await fetch(SRC_URL)
  if (!res.ok) throw new Error(`采集失败：HTTP ${res.status}`)
  const data = await res.json()
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(LOCAL_CACHE, JSON.stringify(data))
  return data
}

/** "初九：潜龙，勿用。" → { title: '初九', text: '潜龙，勿用。' } */
function parseYao(raw) {
  const s = String(raw ?? '').trim()
  const idx = s.indexOf('：')
  if (idx > 0) return { title: s.slice(0, idx).trim(), text: s.slice(idx + 1).trim() }
  const idx2 = s.indexOf(':')
  if (idx2 > 0) return { title: s.slice(0, idx2).trim(), text: s.slice(idx2 + 1).trim() }
  return { title: '', text: s }
}

/** id 字符串（下卦三爻 + 上卦三爻，1=阳）→ 自下而上六爻 */
function linesFromId(id) {
  if (typeof id !== 'string' || id.length !== 6) throw new Error(`卦 id 非法：${id}`)
  return [...id].map((c) => c === '1')
}

async function main() {
  const raw = await loadSource()
  if (!Array.isArray(raw) || raw.length !== 64) {
    throw new Error(`数据集应含 64 卦，实际 ${Array.isArray(raw) ? raw.length : '非数组'}`)
  }

  const items = []
  const yong = []
  let baiHuaMissing = 0
  const conflicts = []

  raw.forEach((g, gi) => {
    const lines = linesFromId(g.id)
    const yaoCi = Array.isArray(g.yao_ci) ? g.yao_ci : []
    const xiaoXiang = Array.isArray(g.xiao_xiang) ? g.xiao_xiang : []
    const name = NAME_FIX[g.name] ?? g.name

    for (let i = 0; i < 6; i++) {
      const { title, text } = parseYao(yaoCi[i])
      const xx = parseYao(xiaoXiang[i]).text
      const yang = lines[i]
      // 爻题与卦象不符 → 源数据自相矛盾，标出来（卦象为准），不擅自改爻题
      const titleYang = title.includes('九')
      const conflict = title !== '' && titleYang !== yang
      if (conflict) {
        conflicts.push(`${gi + 1} ${name} ${title}（爻题示${titleYang ? '阳' : '阴'}，卦象为${yang ? '阳' : '阴'}）`)
      }
      items.push({
        id: `line-${String(gi + 1).padStart(3, '0')}-${i + 1}`,
        index: gi + 1,
        name,
        position: i + 1,
        yaoTitle: title || `${YAO_TITLE[i]}${yang ? '九' : '六'}`,
        yang,
        ci: text,
        xiaoXiang: xx || undefined,
        baiHua: '',
        ...(conflict ? { conflict: true } : {})
      })
      baiHuaMissing++
    }

    // 乾「用九」、坤「用六」：不属于 384 爻，单列为附加条目
    if (yaoCi.length > 6) {
      const { title, text } = parseYao(yaoCi[6])
      yong.push({ index: gi + 1, name: g.name, yaoTitle: title, ci: text })
    }
  })

  // 重复爻辞：不同卦 / 不同爻位出现完全相同的爻辞，疑似采集串位，
  // 不擅自改正，只标记待核（JY-01：异文不作校改，须记录）
  const seen = new Map()
  for (const it of items) {
    const key = it.ci
    if (!key) continue
    const prev = seen.get(key)
    if (prev) {
      it.dupSuspected = true
      prev.dupSuspected = true
    } else {
      seen.set(key, it)
    }
  }
  const dups = items.filter((i) => i.dupSuspected)

  const doc = {
    version: 1,
    kind: 'iching',
    set: 'lines',
    source: '《周易》爻辞与小象，采集自 github.com/freizl/yijing（zh-CN/64gua.json，MIT）',
    license: '古籍原文属公有领域；采集数据集为 MIT；白话（baiHua）为本产品自撰，尚未撰写',
    school: '通行本（王弼注系统 / 文王卦序）',
    sourceNote:
      `爻辞 384 条（六十四卦 × 六爻），另附乾「用九」/坤「用六」${yong.length} 条。` +
      `白话空缺 ${baiHuaMissing} 条，待内容侧补齐（本脚本不生成白话，避免臆造）。` +
      '底本待权威版本核校，reviewed=false。',
    originalFields: ['ci', 'xiaoXiang'],
    reviewed: false,
    yong,
    items
  }

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, 'lines.json'), JSON.stringify(doc, null, 2) + '\n')
  console.log(`[collect-iching] 爻辞 ${items.length} 条 + 用九用六 ${yong.length} 条 → DOCS/content/iching/lines.json`)
  console.log(`[collect-iching] 白话空缺 ${baiHuaMissing} 条（待撰写，不臆造）`)
  console.log(`[collect-iching] 爻题与卦象冲突 ${conflicts.length} 条：${conflicts.join('；')}`)
  console.log(
    `[collect-iching] 疑似重复爻辞 ${dups.length} 条：` +
      dups.map((d) => `${d.index}·${d.position}`).join('、')
  )

  // 交叉核对：与现有 hexagrams.json 的卦辞 / 大象比对
  const hexFile = join(OUT_DIR, 'hexagrams.json')
  if (existsSync(hexFile)) {
    const hex = JSON.parse(readFileSync(hexFile, 'utf8'))
    const diffs = []
    for (const h of hex.items) {
      const g = raw.find((x) => x.name === h.name)
      if (!g) {
        diffs.push(`${h.index} ${h.name}：数据集中无此卦`)
        continue
      }
      const norm = (s) => String(s ?? '').replace(/[：:，。、\s]/g, '')
      const a = norm(h.ci)
      const b = norm(g.gua_ci).replace(/^.*?卦名?/, '')
      if (a && b && !b.includes(a) && !a.includes(b)) {
        diffs.push(`卦辞 ${h.index} ${h.name}：\n  母版 ${h.ci}\n  采集 ${g.gua_ci}`)
      }
      const da = norm(h.daXiang)
      const db = norm(g.da_xiang)
      if (da && db && !db.includes(da) && !da.includes(db)) {
        diffs.push(`大象 ${h.index} ${h.name}：\n  母版 ${h.daXiang}\n  采集 ${g.da_xiang}`)
      }
    }
    console.log(`[collect-iching] 卦辞/大象交叉核对：${diffs.length} 处差异`)
    if (diffs.length) console.log(diffs.join('\n'))
  }

  console.log('[collect-iching] 下一步：npm run content:sync')
}

main().catch((e) => {
  console.error(`[collect-iching] ❌ ${e.message}`)
  process.exit(1)
})
