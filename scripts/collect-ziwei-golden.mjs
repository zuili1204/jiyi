// golden 采集（第二源）：taibu-core@3.5.0（MIT）紫微斗数
//
// 用法：node scripts/collect-ziwei-golden.mjs
//   第一源 = iztro 2.6.1 的本地 dump（DOCS/iztro-main/iztro-main/ziwei-dump-full.json）
//   第二源 = 本脚本（taibu-core 运行时计算）
//   两者**安星算法各自独立实现**（历法输入同源，但命例的农历日期已由 dump 固定，见 YR25）
// 只打印，不写文件；入库由人工逐条 diff 后手填。

import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const taibu = require(resolve(here, '../DOCS/taibu-master/packages/core/dist/index.js'))
const dump = JSON.parse(
  readFileSync(resolve(here, '../DOCS/iztro-main/iztro-main/ziwei-dump-full.json'), 'utf8')
)

/** iztro dump 的时辰中文 → 起始小时 */
const TIME_HOUR = {
  早子时: 0, 丑时: 2, 寅时: 4, 卯时: 6, 辰时: 8, 巳时: 10,
  午时: 12, 未时: 14, 申时: 16, 酉时: 18, 戌时: 20, 亥时: 22, 晚子时: 23
}
/** iztro dump 的 gender 映射（dump 里没有性别，按 golden 用例填） */
const GENDER = {
  'ziwei-001': 'male', 'ziwei-002': 'female', 'ziwei-003': 'male',
  'ziwei-004': 'female', 'ziwei-009': 'male', 'ziwei-010': 'male'
}

/** iztro 侧：命宫支 / 五行局 / 紫微所在宫支 / 主星表 */
function iztroSide(row) {
  const stars = []
  let ziweiAt = ''
  for (const p of row.palaces ?? []) {
    for (const s of p.super ?? []) {
      stars.push(`${p.branch}:${s.name}${s.mutagen ? '(' + s.mutagen + ')' : ''}`)
      if (s.name === '紫微') ziweiAt = p.branch
    }
  }
  return {
    mingGong: row.soulPalace ?? '',
    wuXingJu: row.fiveElementsClass ?? '',
    ziweiAt,
    majorStars: stars
  }
}

/** taibu 侧：命宫支 / 五行局 / 紫微所在宫支 */
function taibuSide(y, m, d, hour, gender) {
  const out = taibu.calculateZiwei({
    birthYear: y,
    birthMonth: m,
    birthDay: d,
    birthHour: hour,
    birthMinute: 0,
    calendarType: 'solar',
    gender
  })
  const palaces = out.palaces ?? out.astrolabe?.palaces
  let ziweiAt = ''
  const stars = []
  for (const p of palaces ?? []) {
    for (const s of p.majorStars ?? p.stars ?? []) {
      const name = typeof s === 'string' ? s : s.name
      stars.push(`${p.earthlyBranch ?? p.branch}:${name}`)
      if (name === '紫微') ziweiAt = p.earthlyBranch ?? p.branch
    }
  }
  return {
    mingGong: out.earthlyBranchOfSoulPalace ?? '',
    wuXingJu: out.fiveElement ?? '',
    ziweiAt,
    stars
  }
}

for (const [id, row] of Object.entries(dump)) {
  if (!row.date || !GENDER[id]) continue
  const [y, m, d] = row.date.split('-').map(Number)
  const hour = TIME_HOUR[row.time ?? ''] ?? 0
  const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const a = iztroSide(row)

  let b
  try {
    b = taibuSide(y, m, d, hour, GENDER[id])
  } catch (e) {
    console.log(`===== ${id} ===== taibu ERROR: ${String(e).split('\n')[0]}`)
    continue
  }

  const sameMing = a.mingGong === b.mingGong
  const sameJu = a.wuXingJu === b.wuXingJu
  const sameZiwei = a.ziweiAt === b.ziweiAt
  console.log(`===== ${id} =====`)
  console.log(
    `命宫 iztro=${a.mingGong} taibu=${b.mingGong} ${sameMing ? '✓' : '✗'} | ` +
      `五行局 iztro=${a.wuXingJu} taibu=${b.wuXingJu} ${sameJu ? '✓' : '✗'} | ` +
      `紫微 iztro=${a.ziweiAt} taibu=${b.ziweiAt} ${sameZiwei ? '✓' : '✗'}`
  )
  console.log('  iztro 主星:', a.majorStars.join(' '))
  if (!sameMing || !sameJu || !sameZiwei) console.log('  taibu 主星:', b.stars.join(' '))
}
