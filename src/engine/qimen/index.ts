import { registerEngine } from '../registry'
import type { DivinationEngine, Interpretation } from '../types'
import type { InputSchema } from '@/types/input'
import type { ReadingRecord } from '@/types/reading'
import { currentDataVersion } from '@/platform/storage'
import { QIMEN_DINGJU_META } from '@/data/content/qimen'
import {
  DUN_LABEL,
  PALACE_DIRECTION,
  QIMEN_KIND,
  QIMEN_METHOD_CHAIBU,
  SAN_YUAN_LABEL
} from './constants'
import { dingJu, type DingJuResult } from './dingJu'
import { earthlyPlate, plateLines, PALACES, PALACE_NAME, type EarthlyPlate, type Palace } from './earthlyPlate'
import { pan, panLines, QIMEN_PAN_REVIEWED, type QimenPan } from './pan'
import { fourPillars } from '@/engine/calendar'

/**
 * 奇门遁甲引擎（Y6，定局法 J6 **暂定**拆补法）
 *
 * 纪律（与 lots / iching 同口径）：
 * - 只算**结构**，不写断语：定局之后还有九星 / 八门 / 八神等层级（Y6-02~04），
 *   未落地之前结果页必须明确说"只有定局"，不编造吉凶；
 * - 母版 `reviewed = false`：结果必须可见地标注"未过权威核校"；
 * - 算不出来就返回明确状态，**不猜**（YR2）。
 */

export interface QimenAt {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

export interface QimenInput {
  /** 问事时刻；留空按当前时刻 */
  at?: QimenAt
  question?: string
}

export interface QimenResult {
  /** 起局时刻（Y6-06 择时块需要；确定性记录，不算 PII） */
  at?: QimenAt
  /** 时柱干支（起局时刻推出） */
  timeGanZhi?: string
  dingJu?: DingJuResult
  /** 地盘三奇六仪（Y6-02）；定局失败时不存在 */
  earthlyPlate?: EarthlyPlate
  /** 天盘 / 值符值使 / 八门（Y6-03）；待核校 */
  pan?: QimenPan
}

// ---------- Y6-06 问事解读 / 择时择方模板 ----------

/** 模板条目（内容侧装入，引擎只见条目不认文件） */
export interface QimenTemplateEntry {
  id: string
  dim: 'wenShi' | 'yongMen' | 'fangWei' | 'zeShi' | 'overall'
  key: string
  label: string
  text: string
  reviewed?: boolean
  source?: { name: string; license: string }
}

/**
 * 模板请求上下文。**不做任何自动分类**：问事类别只来自用户显式选择（`wenShiKey`），
 * 引擎绝不从 `question` 文本推断类别（猜错等于编造）。
 */
export interface QimenTemplateContext {
  wenShiKey?: string
  /** 需要介绍的八门（默认 开门 / 休门 / 生门） */
  menKeys?: string[]
  /** 需要介绍的宫位（择方；由落宫推出，非用户手填） */
  palaceKeys?: string[]
}

let templateProvider: ((ctx: QimenTemplateContext) => QimenTemplateEntry[]) | undefined

export function setQimenTemplateProvider(
  fn: (ctx: QimenTemplateContext) => QimenTemplateEntry[]
): void {
  templateProvider = fn
}

/**
 * 传统上常说的三门（开 / 休 / 生）：仅作取用口径介绍，不构成吉凶判断。
 *
 * ⚠️ 数据口径：`pan.doors` 存的是**单字门名**（`DOOR_ORDER`），
 * 展示时由本模块补「门」字，切勿在模板 key 里写成「开门」。
 */
export const SAN_MEN = ['开', '休', '生'] as const

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** 传统上常说的三门（开 / 休 / 生）在**本局**的落宫 */
function menPalaces(doors: Record<number, string | null>): { men: string; palace: Palace }[] {
  const out: { men: string; palace: Palace }[] = []
  for (const m of SAN_MEN) {
    const n = PALACES.find((p) => doors[p] === m)
    if (n) out.push({ men: m, palace: n })
  }
  return out
}

/**
 * Y6-06 问事解读 / 择时择方区块。
 *
 * 纪律（与 JY-04 §3 一致）：
 * - 只呈现**结构**（门落何宫、宫为何方位）+ 传统取用口径的**介绍**；
 * - 不写吉凶断语、不给应期、不替用户决断；
 * - 模板未装载（内容层缺失）时走 L3：只给结构与方位，**不编造断语**。
 */
function qimenY6Blocks(
  p: QimenPan,
  at?: QimenAt,
  timeGanZhi?: string
): NonNullable<Interpretation['blocks']> {
  const pos = menPalaces(p.doors)
  const blocks: NonNullable<Interpretation['blocks']> = []
  const tpls = templateProvider?.({
    menKeys: [...SAN_MEN],
    palaceKeys: pos.map((x) => String(x.palace))
  })
  const pick = (dim: QimenTemplateEntry['dim'], key: string) =>
    tpls?.find((t) => t.dim === dim && t.key === key)
  const overall = tpls?.find((t) => t.dim === 'overall')

  if (!tpls || tpls.length === 0) {
    if (pos.length) {
      blocks.push({
        key: 'yongMenStructure',
        label: '三门落宫（结构）',
        text: pos
          .map(
            (x) =>
              `${x.men}门落 ${PALACE_NAME[x.palace]}${x.palace} 宫（${PALACE_DIRECTION[x.palace]}）`
          )
          .join('　'),
        level: 'l3'
      })
    }
    blocks.push({
      key: 'y6Pending',
      label: '状态',
      text: '问事解读模板未装载：只呈现盘面结构与落宫方位，不编造断语、不作吉凶判断。',
      level: 'l3'
    })
    return blocks
  }

  const wenShi = pick('wenShi', 'zonghe')
  if (wenShi) {
    blocks.push({
      key: 'wenShi',
      label: `问事取用 · ${wenShi.label}`,
      text: wenShi.text,
      level: 'l2'
    })
  }

  if (pos.length) {
    const lines = pos.map((x) => {
      const t = pick('yongMen', x.men)
      const fw = pick('fangWei', String(x.palace))
      const where = `${PALACE_NAME[x.palace]}${x.palace} 宫（${PALACE_DIRECTION[x.palace]}）`
      return `${x.men}门：落 ${where}${fw ? `｜${fw.label}` : ''}${t ? `\n　${t.text}` : ''}`
    })
    blocks.push({
      key: 'yongMen',
      label: '取用参照（传统口径介绍）',
      text: lines.join('\n'),
      level: 'l2'
    })
    blocks.push({
      key: 'zeFang',
      label: '择方参照',
      text:
        `本局开 / 休 / 生三门所在方位：${pos
          .map((x) => `${x.men}门→${PALACE_DIRECTION[x.palace]}`)
          .join('；')}。` +
        '此为宫位与方位的结构呈现，不构成出行或方位建议。',
      level: 'l2'
    })
  }

  const zs = pick('zeShi', 'overall')
  if (zs) {
    const when = at
      ? `${at.year}-${pad2(at.month)}-${pad2(at.day)} ${pad2(at.hour)}:${pad2(at.minute)}`
      : '（本局未记录起局时刻）'
    blocks.push({
      key: 'zeShi',
      label: `择时 · ${zs.label}`,
      text: `本局起局时刻：${when}${timeGanZhi ? `（时柱 ${timeGanZhi}）` : ''}\n${zs.text}`,
      level: 'l2'
    })
  }

  if (overall) {
    blocks.push({ key: 'qimenOverall', label: overall.label, text: overall.text, level: 'l2' })
  }
  return blocks
}

export const QIMEN_SCHEMA: InputSchema = {
  fields: [
    {
      key: 'at',
      label: '问事时刻',
      type: 'datetime',
      required: false,
      help: '留空则按当前时刻；阴阳遁与三元由此推出'
    },
    { key: 'question', label: '所问何事（可选）', type: 'text', required: false }
  ]
}

function nowAt(): QimenAt {
  const d = new Date()
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes()
  }
}

export const qimenChaibuEngine: DivinationEngine<QimenInput, QimenResult> = {
  kind: QIMEN_KIND,
  method: QIMEN_METHOD_CHAIBU,

  compute(input: QimenInput): QimenResult {
    // 奇门起局是**确定性**的（时间决定局数），不需要随机源
    const at = input?.at ?? nowAt()
    const dj = dingJu(at)
    if (!dj) return { at }
    const plate = earthlyPlate(dj.dun, dj.ju)
    if (!plate) return { at, dingJu: dj }
    // 值符值使由**时柱干支**定（值符随时干、值使随时支）
    const time = fourPillars(at).time
    return {
      at,
      timeGanZhi: `${time.gan}${time.zhi}`,
      dingJu: dj,
      earthlyPlate: plate,
      pan: pan(dj.dun, dj.ju, time)
    }
  },

  interpret(r: QimenResult): Interpretation {
    const dj = r.dingJu
    if (!dj) {
      return {
        title: '奇门 · 定局失败',
        summary: '未能定局',
        blocks: [
          {
            key: 'pending',
            label: '状态',
            text: '定局失败：取不到节气或日支。不做兜底猜测（算不出就是算不出）。',
            level: 'l3'
          }
        ],
        degraded: ['dingJu']
      }
    }

    const dunText = DUN_LABEL[dj.dun]
    const pan = r.pan
    const plate = r.earthlyPlate
    // Y6-06：问事解读 / 择时择方（模板来自内容层）
    const y6Blocks = pan ? qimenY6Blocks(pan, r.at, r.timeGanZhi) : []
    return {
      title: `${dunText}${dj.ju} 局 · ${dj.term}${SAN_YUAN_LABEL[dj.yuan]}`,
      summary: `${dunText}${dj.ju} 局（${dj.term}）`,
      blocks: [
        { key: 'dun', label: '阴阳遁', text: `${dunText}（以 ${dj.term} 为界）`, level: 'l3' },
        {
          key: 'yuan',
          label: '三元',
          text: `${SAN_YUAN_LABEL[dj.yuan]}（日柱 ${dj.dayGanZhi}）`,
          level: 'l3'
        },
        { key: 'ju', label: '局数', text: `${dunText}${dj.ju} 局`, level: 'l3' },
        ...(plate
          ? [
              {
                key: 'plate',
                label: '地盘三奇六仪',
                text: plateLines(plate).join('　'),
                level: 'l3' as const
              }
            ]
          : []),
        ...(pan
          ? [
              {
                key: 'xunShou',
                label: '旬首',
                text: `${pan.xunShou.ganZhi}旬 · 遁${pan.xunShou.yi}（地盘 ${pan.xunShou.palace} 宫）`,
                level: 'l3' as const
              },
              {
                key: 'zhiFu',
                label: '值符',
                text: `${pan.zhiFu.star}落 ${pan.zhiFu.palace} 宫（随时干）`,
                level: 'l3' as const
              },
              {
                key: 'zhiShi',
                label: '值使',
                text: `${pan.zhiShi.door}门落 ${pan.zhiShi.palace} 宫（随时支）`,
                level: 'l3' as const
              },
              {
                key: 'pan',
                label: '天盘（星 / 干 / 门）',
                text: panLines(pan, plate!).join('\n'),
                level: 'l3' as const
              },
              {
                key: 'gods',
                label: '八神',
                text: PALACES.filter((n) => pan!.gods[n])
                  .map((n) => `${PALACE_NAME[n]}宫：${pan!.gods[n]}`)
                  .join('　'),
                level: 'l3' as const
              },
              {
                key: 'kongWang',
                label: '空亡',
                text: `时旬空亡：${pan.kongWang.join('')}（${pan.kongWangPalaces
                  .map((p) => `${PALACE_NAME[p]}宫`)
                  .join('、')}）`,
                level: 'l3' as const
              },
              {
                key: 'maXing',
                label: '驿马',
                text: `驿马：${pan.maXing}（${PALACE_NAME[pan.maXingPalace]}宫）`,
                level: 'l3' as const
              }
            ]
          : []),
        ...y6Blocks,
        {
          key: 'pending',
          label: '状态',
          text:
            '九宫结构（地盘 / 天盘 / 九星 / 八门 / 八神 / 空亡 / 驿马）已完整呈现，口径对照《烟波钓叟歌》与转盘奇门通行逐步对齐。' +
            '八神次序采用通行常见序（值符·螣蛇·太阴·六合·白虎·玄武·九地·九天），值符随值符星位、阳顺阴逆。' +
            '问事解读与择时择方只提供取用口径介绍与本局结构呈现；本盘不做吉凶断语、不给应期。',
          level: 'l3'
        },
        {
          key: 'caveat',
          label: '说明',
          text: '定局法按拆补法·日支呈现；盘面（地盘 / 天盘 / 九星 / 八门 / 八神 / 空亡 / 驿马）采用通行口径，仅供参考。',
          level: 'l3'
        }
      ],
      basis: {
        term: dj.term,
        dun: dj.dun,
        yuan: dj.yuan,
        ju: dj.ju,
        dayGanZhi: dj.dayGanZhi,
        dingJuMethod: QIMEN_DINGJU_META.dingJuMethod,
        ...(r.earthlyPlate
          ? { plate: r.earthlyPlate.cells, plateOrder: dunText === '阳遁' ? '顺' : '逆' }
          : {}),
        ...(pan && plate
          ? (() => {
              return {
                xunShou: pan.xunShou,
                zhiFu: pan.zhiFu,
                zhiShi: pan.zhiShi,
                kongWang: pan.kongWang,
                kongWangPalaces: pan.kongWangPalaces,
                maXing: pan.maXing,
                maXingPalace: pan.maXingPalace,
                stars: pan.stars,
                heavenlyGan: pan.heavenlyGan,
                doors: pan.doors,
                panNotes: pan.notes,
                // 九宫结构（供 UI 九宫格渲染，避免 UI 直接依赖引擎内部类型）
                // 值符 / 值使 / 空亡 / 马星落宫一并带出，UI 只做高亮、不再自行推宫
                qimenPan: PALACES.map((n) => ({
                  palace: n,
                  name: PALACE_NAME[n],
                  earthlyGan: plate.cells[n],
                  heavenlyGan: pan.heavenlyGan[n],
                  star: pan.stars[n],
                  door: pan.doors[n],
                  god: pan.gods[n],
                  isZhiFu: pan.zhiFu.palace === n,
                  isZhiShi: pan.zhiShi.palace === n,
                  isKong: pan.kongWangPalaces.includes(n),
                  isMa: pan.maXingPalace === n
                }))
              }
            })()
          : {})
      },
      // 盘面已转正；仅保留「八神阴阳遁分表」这一存疑口径的如实标注
      degraded: QIMEN_PAN_REVIEWED ? ['baShen-yinyang-split-undecided'] : ['gods-kongwang-maxing-unverified'],
      source: `${QIMEN_DINGJU_META.source}:${QIMEN_DINGJU_META.license}`,
      school: QIMEN_DINGJU_META.school
    }
  }
}

registerEngine(qimenChaibuEngine)

/** 组装一条可落库的奇门记录（供 store / 测试复用） */
export function buildQimenRecord(input: QimenInput, id: string): ReadingRecord {
  const result = qimenChaibuEngine.compute(input, {
    next: () => 0,
    int: () => 0
  })
  return {
    id,
    kind: QIMEN_KIND,
    method: QIMEN_METHOD_CHAIBU,
    schemaVersion: 1,
    dataVersion: currentDataVersion(),
    createdAt: Date.now(),
    input: { ...input },
    result: result as unknown as Record<string, unknown>,
    interpretation: qimenChaibuEngine.interpret(result),
    piiFields: []
  }
}

export { dingJu, currentJieQi, sanYuanOf } from './dingJu'
export type { DingJuResult } from './dingJu'
export { earthlyPlate, plateLines, PALACES, PALACE_NAME, QI_YI_YANG, QI_YI_YIN } from './earthlyPlate'
export * from './reference'
export type { EarthlyPlate, Palace } from './earthlyPlate'
export {
  pan,
  panLines,
  xunShouIndex,
  xunShouYi,
  STAR_BY_PALACE,
  STAR_ORDER,
  DOOR_BY_PALACE,
  DOOR_ORDER,
  ZHI_PALACE,
  BA_SHEN,
  XUN_SHOU_YI
} from './pan'
export type { QimenPan } from './pan'
export * from './constants'
