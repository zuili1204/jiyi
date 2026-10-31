/**
 * 吕祖灵签吉凶等级推导（Y2-02 缺口补全）
 *
 * 背景：吕祖灵签在整个中文网络（nongli/jixing/ttlingqian/smxs 等）均无结构化
 * 「吉凶等级」字段——等级词只散落在解签散文里，多家明言「一切都要自行会意」。
 * 因此标准吕祖签传统上不附等级。为补齐字段，采用透明、可审计的两段式推导：
 *   1) 源文显式出现等级词（大吉/上上/上吉/中吉/中平/中下/下下）→ 信任源文（levelSource='source'）
 *   2) 否则对签文（解曰+释义+仙机+签诗）做关键词极性打分 → 推断（levelSource='inferred'）
 * 等级词表与关帝七档一致（大吉/上上/上吉/中吉/中平/中下/下下），属娱乐参考，
 * 上架前需权威 golden 核验（Y0-03）。
 */
import fs from 'node:fs'

const SRC = 'src/data/content/lots/lvzu.raw.json'
const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'))
if (!fs.existsSync(SRC + '.bak')) fs.writeFileSync(SRC + '.bak', fs.readFileSync(SRC)) // 仅首次备份原始文件

// 显式等级词（顺序即优先级，复现源文标注）
const EXPLICIT = /(上上|上吉|中吉|中平|中下|下下|大吉|小吉|上中|下上)/

// 决定性吉/凶短语：只统计明确指向「结果好坏」的词，避免被劝诫性/装饰性字眼带偏
const POS_C = [
  ['大吉',2],['上上',2],['上吉',1],['中吉',1],['吉庆',2],['祯祥',2],['如意',2],['平安',2],
  ['顺利',2],['亨通',2],['称心',2],['美满',2],['百事成',2],['称意',1],['遂意',1],['得志',1],
  ['显达',1],['光明',1],['逢凶化吉',2],['转危为安',2],['化险为夷',2],['无碍',1],['无忧',1],
  ['可成',1],['易成',1],['顺遂',1],['兴家',1],['旺财',1],['得财',1],['得喜',1],['添丁',1],
  ['家和',1],['吉人天相',2],['万事亨通',2],['福星',1],['吉星',1],['大展',1]
]
const NEG_C = [
  ['下下',-2],['不吉',-2],['凶险',-2],['凶兆',-2],['灾',-1],['祸',-1],['失利',-1],['失败',-1],
  ['破败',-1],['离散',-1],['闭塞',-1],['阻碍',-1],['不遂',-1],['危难',-1],
  ['忧患',-1],['破损',-1],['亡',-1],['蹇滞',-1],['阻滞',-1],['凶多吉少',-2],['诸事不宜',-2],
  ['凡事不吉',-2],['大祸',-2],['厄运',-1],['困顿',-1],['落空',-1],['破财',-1],['失意',-1],
  ['别离',-1],['灾厄',-1],['不祥',-2],['凶事',-2]
]

function polarity(text) {
  let score = 0
  for (const [w, wv] of POS_C) score += (text.split(w).length - 1) * wv
  for (const [w, wv] of NEG_C) score += (text.split(w).length - 1) * wv
  return score
}

function mapGrade(score) {
  if (score >= 4) return '大吉'
  if (score >= 2) return '上上'
  if (score >= 1) return '上吉'
  if (score === 0) return '中平'
  if (score >= -1) return '中下'
  return '下下'
}

let sourceN = 0, inferredN = 0
const dist = {}
for (const e of raw) {
  const text = [e.interpretation, e.poem?.join(' '), e.story || ''].filter(Boolean).join(' ')
  const m = text.match(EXPLICIT)
  if (m) {
    e.level = m[1]
    e.levelSource = 'source'
    sourceN++
  } else {
    e.level = mapGrade(polarity(text))
    e.levelSource = 'inferred'
    inferredN++
  }
  dist[e.level] = (dist[e.level] || 0) + 1
}

fs.writeFileSync(SRC, JSON.stringify(raw, null, 2))

console.log('source-derived:', sourceN, ' inferred:', inferredN)
console.log('distribution:', JSON.stringify(dist))
// 抽检：已知语义
for (const n of [1, 3, 22, 34, 41, 50, 67, 100]) {
  const e = raw.find((x) => x.number === n)
  console.log(`#${n} -> ${e.level} (${e.levelSource})`)
}
