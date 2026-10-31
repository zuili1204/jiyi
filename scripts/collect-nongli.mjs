// 关帝 / 吕祖 灵签母版采集管线（JY-04 内容闸 §3：采集可追溯）
//
// 来源：农历网 nongli.com（标称源自泉州通淮关岳庙诗签 / 吕祖签文，民俗整理）
//  - 关帝：https://www.nongli.com/item5/guandi/{n}.html   (n = 1..100)
//  - 吕祖：https://www.nongli.com/item5/lzlq/{n}.html     (n = 1..100)
// 落盘：src/data/content/lots/{guandi,lvzu}.raw.json
//
// 解析策略（对两端 HTML 结构差异稳健）：
//  - 签号：取自 URL 数字（最可靠）
//  - 吉凶(level)：取自 <title> 末尾词（如「大吉」「上上」）
//  - 签诗(poem)：取「诗曰」到下一个「【」之间的文本，按行拆分
//  - 解曰(interpretation)：取「诗曰」之后、正文截止（去除页脚 boilerplate）的文本
//  - 典故(story)：若存在「典故/古人」则取，否则留空
//
// 注意：此脚本仅做「采集 + 结构化落盘」；字段映射/出处标注在
//       src/data/content/lots/index.ts 完成。准确性需独立 golden 核验（Y0-03）。

import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '../src/data/content/lots')

const KINDS = {
  guandi: { label: '关帝灵签', base: 'https://www.nongli.com/item5/guandi/' },
  lvzu: { label: '吕祖灵签', base: 'https://www.nongli.com/item5/lzlq/' }
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n')
}

function cutBoilerplate(t) {
  const markers = ['相关推荐', '相关内容', '上一篇', '下一篇', '免责声明', '版权所有', 'ICP备', '返回顶部', '手机查看', '扫码', '分享到']
  for (const m of markers) {
    const i = t.indexOf(m)
    if (i >= 0) t = t.slice(0, i)
  }
  return t.trim()
}

const KNOWN_GRADES = ['上上', '上吉', '中吉', '中平', '中下', '下下', '大吉', '小吉', '上中', '下上']

function extractLevel(title, text) {
  const tail = title.split('_')[0].trim().split(/\s+/).filter(Boolean)
  const last = tail[tail.length - 1] || ''
  if (KNOWN_GRADES.includes(last)) return last
  // 正文最佳努力提取（负向前瞻仅避开「大吉祥」这类非等级表述）
  const m = text.match(/(上上|上吉|中吉|中平|中下|下下|大吉|小吉|上中|下上)(?!祥)/)
  return m ? m[1] : ''
}

function toLines(s) {
  return s
    .split(/[\n，,；;]/)
    .map((x) => x.trim())
    .filter(Boolean)
}

function parse(html, num, kind) {
  const number = num
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
  const title = titleMatch ? titleMatch[1] : ''
  const level = extractLevel(title, '')

  const text = stripHtml(html)

  // 签诗：优先【签文】块（吕祖传统签诗），否则【诗曰】
  const poemMarker = text.includes('签文') ? text.indexOf('签文') : text.indexOf('诗曰')
  let poem = []
  if (poemMarker >= 0) {
    const poemEnd = text.indexOf('【', poemMarker + 1)
    const poemRaw = poemEnd >= 0 ? text.slice(poemMarker, poemEnd) : text.slice(poemMarker)
    poem = toLines(poemRaw.replace(/^(签文|诗曰)[:：]?/, '').replace(/^】/, ''))
  }

  // 解曰：最后一段签诗标记之后的正文（去除页脚 boilerplate）
  const lastMarker = Math.max(text.lastIndexOf('诗曰'), text.lastIndexOf('签文'))
  let interpretation = ''
  if (lastMarker >= 0) {
    const start = text.indexOf('【', lastMarker + 1)
    interpretation = cutBoilerplate(text.slice(start >= 0 ? start : lastMarker))
  }
  if (!interpretation) {
    const di = text.lastIndexOf('解曰')
    if (di >= 0) interpretation = cutBoilerplate(text.slice(di))
  }

  // 典故（可选，仅取标记后的短名/单行，避免吞入后续导语）
  let story = ''
  const sm = text.match(/(?:典故|古人)[:：]?\s*([^【\n]+)/)
  if (sm) story = sm[1].replace(/^】/, '').trim()

  // 吉凶：标题无则再从正文提取（吕祖页常缺）
  const level2 = extractLevel(title, text)

  return {
    number,
    level: level2,
    poem,
    interpretation,
    story,
    category: kind
  }
}

async function fetchOne(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JiYiCollector/1.0)' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.text()
    } catch (e) {
      if (attempt === retries) throw e
      await new Promise((r) => setTimeout(r, 300 * attempt))
    }
  }
}

async function collect(kind) {
  const cfg = KINDS[kind]
  const out = []
  const missing = []
  for (let n = 1; n <= 100; n++) {
    const url = `${cfg.base}${n}.html`
    try {
      const html = await fetchOne(url)
      const entry = parse(html, n, kind)
      if (!entry.poem.length || !entry.interpretation) {
        missing.push(`#${n} 解析异常(level=${entry.level} poem=${entry.poem.length} 解=${entry.interpretation.length})`)
      }
      out.push(entry)
      process.stdout.write(`\r  ${cfg.label} ${n}/100`)
    } catch (e) {
      missing.push(`#${n} 抓取失败: ${e.message}`)
    }
  }
  process.stdout.write('\n')
  const file = resolve(OUT_DIR, `${kind}.raw.json`)
  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(file, JSON.stringify(out, null, 2) + '\n', 'utf8')
  console.log(`[collect] 已写入 ${out.length} 签 -> ${file}`)
  if (missing.length) {
    console.warn(`[collect] ${missing.length} 条需复核：`)
    for (const m of missing) console.warn('   - ' + m)
  }
  return { count: out.length, missing }
}

// ---- 离线校验模式：读取本地样本，打印解析结果 ----
async function testLocal() {
  for (const f of ['.tmp_guandi_1.html', '.tmp_lvzu_1.html']) {
    const html = await readFile(resolve(process.cwd(), f), 'utf8')
    const kind = f.includes('guandi') ? 'guandi' : 'lvzu'
    const e = parse(html, 1, kind)
    console.log(`\n=== ${f} ===`)
    console.log('level:', e.level)
    console.log('poem:', JSON.stringify(e.poem))
    console.log('story:', e.story)
    console.log('interpretation[:200]:', e.interpretation.slice(0, 200))
  }
}

const mode = process.argv[2]
if (mode === '--test') {
  testLocal().catch((e) => {
    console.error(e)
    process.exit(1)
  })
} else if (mode && KINDS[mode]) {
  collect(mode).catch((e) => {
    console.error('[collect] 失败:', e.message)
    process.exit(1)
  })
} else {
  console.log('用法:')
  console.log('  node scripts/collect-nongli.mjs --test       # 离线校验本地样本')
  console.log('  node scripts/collect-nongli.mjs guandi       # 抓取关帝灵签')
  console.log('  node scripts/collect-nongli.mjs lvzu         # 抓取吕祖灵签')
  process.exit(1)
}
