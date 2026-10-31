// 生成紫微「星宫组合母版」 palaceStars.json（Y5-07）
//
// 纪律（对齐八字 bazi/duanYu.json 与 JY-04 §3）：
//   - 内容是**本产品自撰的中性参考**，非古籍逐字引用；
//   - 措辞规避绝对化 / 医疗 / 投资 / 法律 / 性别 / 灾祸 / 宗教 / 权威等敏感词族，
//     **不豁免**、走 compliance.rules.json 全词族严检；
//   - 只写「星曜气质 × 宫位主旨」的组合参考，不作吉凶断语与具体应验；
//   - 产出 14 主星 × 12 宫 = 168 + 12 双星 × 12 宫 = 144，共 312 条，
//     满足 Y5-07 验收「14×12 + 双星 12×12 齐全」。
//
// 用法：node scripts/gen-palacestars.mjs
//   生成后须跑 `npm run content:sync` 回写 src，再 npm test / vue-tsc。

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TARGET = join(ROOT, 'DOCS', 'content', 'ziwei', 'palaceStars.json')

/** 十二宫（自命宫逆排，与 engine/ziwei/palace.ts 的 ZIWEI_GONG_ORDER 顺序一致） */
const GONGS = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '奴仆', '官禄', '田宅', '福德', '父母']

/** 十四正曜（与 engine/ziwei/siHua.ts 的 ZIWEI_MAIN_STARS 一致） */
const MAIN_STARS = [
  '紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府',
  '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'
]

/** 单星气质（中性描述，非吉凶） */
const STAR_TRAIT = {
  紫微: '持重而主序，统整与框架感较强',
  天机: '机敏善思，长于转圜与疾速应变',
  太阳: '光明坦荡，以发散与承载见长',
  武曲: '果决务实，以执行与推进见长',
  天同: '宽和近亲，以排解与调和见长',
  廉贞: '敏锐多思，以察微与持节见长',
  天府: '稳重能储，以守成与包容见长',
  太阴: '内敛温润，以观照与静养见长',
  贪狼: '好奇求新，以拓展与吸交见长',
  巨门: '善言宣说，以沟通与辨理见长',
  天相: '端方协助，以规整与配合见长',
  天梁: '持节存心，以匡扶与关照见长',
  七杀: '刚猛果进，以破旧立新见长',
  破军: '敢为趋变，以更替与开创见长'
}

/** 宫位主旨（中性，指向该宫常关注的领域与侧重） */
const GONG_THEME = {
  命宫: '可把本命当作一面镜子，对照自身行事节奏',
  兄弟: '共事时先厘清分工与沟通，再看彼此借力',
  夫妻: '在亲密相处里留出节奏与分寸',
  子女: '面对晚辈或后进，宜因材与耐心',
  财帛: '资源经营，宜看重计划与可持续',
  疾厄: '照顾身心，宜规律作息与主动觉察',
  迁移: '外出变动之际，先立定点再图推进',
  奴仆: '待人接物，宜边界清晰不越界',
  官禄: '行事尽责，宜务实而有条理',
  田宅: '置产而居，宜审慎评估长远打算',
  福德: '兴趣与精神生活，宜留白与自观',
  父母: '面对长辈与成长，宜体谅且有耐心'
}

/** 12 组双星（十四正曜内两星同守的常见组合） */
const DUAL_STARS = [
  '紫微天府', '紫微天机', '紫微天相', '紫微天梁', '紫微七杀', '紫微破军',
  '武曲天相', '武曲七杀', '武曲贪狼', '廉贞天相', '廉贞七杀', '廉贞破军'
]

/** 双星气质（中性） */
const DUAL_TRAIT = {
  '紫微天府': '守成与掌序并重，兼顾稳重与担当',
  '紫微天机': '统筹之中留一丝转圜应变的余地',
  '紫微天相': '持序辅佐，守框架亦热心协助',
  '紫微天梁': '持节自持，偏重以身作则',
  '紫微七杀': '刚决果进，宜自律守限',
  '紫微破军': '自主求新，大变当前尤须是非分明',
  '武曲天相': '重执行与条理，循序渐进',
  '武曲七杀': '刚锐一并，宜克制欲速之计',
  '武曲贪狼': '求能却求新，宜定重心免顺此失彼',
  '廉贞天相': '机敏而规整，察微中守分寸',
  '廉贞七杀': '锐决而厉，起落间先立心防',
  '廉贞破军': '求变而敏，宜量力而行'
}

const CLOSING = '此为本产品自撰的参考框架，非定论，实际影响仍受多方因素综合作用，宜结合自身实况自主判断。'

const STAR_ID = {
  紫微: 'ziwei', 天机: 'tianji', 太阳: 'taiyang', 武曲: 'wuqu', 天同: 'tiantong',
  廉贞: 'lianzhen', 天府: 'tianfu', 太阴: 'taiyin', 贪狼: 'tanlan', 巨门: 'jumen',
  天相: 'tianxiang', 天梁: 'tianliang', 七杀: 'qisha', 破军: 'pojun'
}
const GONG_ID = {
  命宫: 'ming', 兄弟: 'xiongdi', 夫妻: 'fuqi', 子女: 'zinv', 财帛: 'caibo',
  疾厄: 'jie', 迁移: 'qianyi', 奴仆: 'nupu', 官禄: 'guanlu', 田宅: 'tianzhai',
  福德: 'fude', 父母: 'fumu'
}

/** 单星一条 */
function singleItem(star, gong) {
  return {
    id: `ziwei.star.${STAR_ID[star]}.${GONG_ID[gong]}`,
    kind: 'single',
    star,
    gong,
    text: `${star}落于「${gong}」，${STAR_TRAIT[star]}。就「${gong}」而言，${GONG_THEME[gong]}。${CLOSING}`
  }
}

/** 双星一条 */
function dualItem(dual, gong) {
  return {
    id: `ziwei.dual.${dualToId(dual)}.${GONG_ID[gong]}`,
    kind: 'dual',
    stars: dual,
    gong,
    text: `「${dual}」同宫于「${gong}」，${DUAL_TRAIT[dual]}。在「${gong}」之事上，${GONG_THEME[gong]}。${CLOSING}`
  }
}
/** 双星 → id 片段（两正曜各自的 latin，用 `x` 连接） */
function dualToId(dual) {
  let out = ''
  let i = 0
  while (i < dual.length) {
    for (const s of Object.keys(STAR_ID)) {
      if (dual.startsWith(s, i)) {
        out += STAR_ID[s] + 'x'
        i += s.length
        break
      }
    }
  }
  return out.slice(0, -1) || dual
}

const items = []

// 单星 14 × 12
for (const star of MAIN_STARS) {
  for (const gong of GONGS) {
    items.push(singleItem(star, gong))
  }
}
// 双星 12 × 12
for (const dual of DUAL_STARS) {
  for (const gong of GONGS) {
    items.push(dualItem(dual, gong))
  }
}

const doc = {
  version: 1,
  kind: 'ziwei',
  set: 'palaceStars',
  source: '本产品自撰（基于十四正曜气质与十二宫主旨的中性参考，非古籍逐字引用）',
  sourceNote:
    '星宫与双星组合均为中性参考提示，供结果页生成「星宫」导读。**非正式命理结论，`reviewed:false`，待权威核核校**；措辞已规避绝对化 / 医疗 / 投资 / 性别 / 灾祸等敏感词（JY-04 §3），不豁免，走全词族严检。',
  license: '原创自撰白字；素材与措辞为本产品原创',
  school: '三合派（流派 J3 已拍板）',
  originalFields: [],
  reviewed: false,
  items
}

mkdirSync(dirname(TARGET), { recursive: true })
writeFileSync(TARGET, JSON.stringify(doc, null, 2) + '\n', 'utf8')
// eslint-disable-next-line no-console
console.log(`[gen-palacestars] 写出 ${items.length} 条 → ${TARGET}`)