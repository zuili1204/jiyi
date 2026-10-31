import { registerEngine } from '../registry'
import type { DivinationEngine, Interpretation, InterpretationBlock } from '../types'
import type { InputSchema } from '@/types/input'
import type { ReadingRecord } from '@/types/reading'
import { currentDataVersion } from '@/platform/storage'
import { fourPillars, solarToLunar, type DiZhi } from '@/engine/calendar'
import { determineMingGong, ZIWEI_GONG_ORDER, type MingGongResult, type ZiweiGongName } from './palace'
import { computeSiHua, type SiHuaResult, SI_HUA_REVIEWED } from './siHua'
import {
  arrangeZhuXing,
  computeDaXian,
  siHuaByPalace,
  type ZhuXingResult,
  type DaXianResult,
  type SiHuaToPalace
} from './zhuXing'
import { arrangeFuXing } from './fuXing'
import { arrangeZaYao } from './zaYao'
import {
  computeLiuNian,
  computeXiaoXian,
  XIAO_XIAN_REVIEWED,
  type LiuNianResult
} from './liuNian'

/**
 * 紫微引擎（Y5，起步：Y5-01 定命宫 + 五行局）
 *
 * ⚠️ 本品类输入是**出生数据**（PII），与八字共用同一条独立同意流程（Y4-04 / J4）：
 * 未授权不落盘（HomeView 的 `birth` 玩法分支复用 `BirthDataConsent` 与
 * `settings.birthDataConsent`，**零重复实现** Y5-08）。
 *
 * 纪律：
 * - 已至此「定命宫 + 五行局 + 四柱主星 + 辅煞 + 四化 + 大限 + 流年」（Y5-01~03/05）；
 * - 流派 J3 待拍板；**生月 / 生日按农历**（经 lunar-typescript 公历换算，对照 iztro 已核）；
 *   闰月口径、小限、杂曜余项 8 颗（天官·天福·三台·八座·恩光·天贵·蜚廉·月解）仍待补/待核；
 * - golden 未采（Y5-09），所以**不宣称正确**。
 */

export const ZIWEI_KIND = 'ziwei' as const
export const ZIWEI_METHOD = 'minggong'

export const ZIWEI_POLICIES = {
  /** 生月 / 生日按**农历**（经 lunar-typescript 公历换算；对照 iztro 7 例已核，2026-09-20）；
   * 闰月口径、小限公式待核校，故整体 reviewed 仍需落 golden / 权威核准 */
  calendarBasis: '农历月 / 日（公历经农历换算）',
  reviewed: false
} as const

export interface ZiweiInput {
  year: number
  month: number // 1-12
  day: number
  hour: number // 0-23
  minute: number
  place?: string
  gender?: 'male' | 'female'
  useTrueSolar?: boolean
  /** 流年指定的公历年；不填用当前年份（M5 甲流） */
  liuNianYear?: number
}

export interface ZiweiResult {
  mingGong: MingGongResult
  /** 安星（14 正曜落宫，Y5-02） */
  zhuXing: ZhuXingResult
  /** 大限（Y5-05，需性别） */
  daXian: DaXianResult
  /** 四化按宫落位（Y5-03） */
  siHuaByPalace: SiHuaToPalace[]
  /** 辅煞（核心部分，Y5-03） */
  fuXing: Record<string, string[]>
  /** 杂曜（Y5-03 后半） */
  zaYao: Record<string, string[]>
  /** 流年（Y5-05，M5 甲流） */
  liuNian: LiuNianResult
  siHua: SiHuaResult
  input: ZiweiInput
}

export const ZIWEI_SCHEMA: InputSchema = {
  fields: [
    {
      key: 'at',
      label: '出生时刻',
      type: 'datetime',
      required: true,
      pii: true,
      calendar: true,
      help: '公历时刻；紫微按农历生月定命宫（闰月口径待核校）'
    },
    {
      key: 'place',
      label: '出生地',
      type: 'place',
      required: false,
      pii: true,
      help: '用于真太阳时订正（当前版本仅影响时辰归属，不另作换算）'
    },
    {
      key: 'gender',
      label: '性别',
      type: 'gender',
      required: false,
      pii: true,
      help: '用于大限顺逆；不提供则不排大限，但安星 / 四化不受影响'
    }
  ]
}

/**
 * 星宫组合母版（Y5-07）：由内容层按「星 × 宫」取中性参考，
 * 供结果页在星宫结构之后出参考块。缺源时降级（不猜）。
 */
export interface ZiweiPalaceEntry {
  id: string
  kind: 'single' | 'dual'
  star: string
  gong: ZiweiGongName
  text: string
}
export type ZiweiPalaceProvider = (
  palaces: { name: ZiweiGongName; branch: string; mainStars: string[] }[]
) => ZiweiPalaceEntry[] | undefined

let palaceProvider: ZiweiPalaceProvider | null = null

export function setZiweiPalaceProvider(p: ZiweiPalaceProvider | null): void {
  palaceProvider = p
}

/** 取某宫主星集合，若是两星则按双星条目查（整串），否则按单星查（取首星） */
function palaceReferenceBlocks(
  mg: MingGongResult,
  mainStars: Record<string, string[]>
): InterpretationBlock[] {
  const rows = palaceProvider?.(
    mg.twelveGong.map((g) => ({
      name: g.name,
      branch: g.branch,
      mainStars: mainStars[g.branch] ?? []
    }))
  )
  if (!rows || rows.length === 0) return []
  const lines = rows.map((r) => {
    const pos = r.kind === 'dual' ? `${r.star}同宫于「${r.gong}」` : `${r.star}于「${r.gong}」`
    return `${pos}：${r.text}`
  })
  return [
    {
      key: 'palaceReference',
      label: '星宫参考',
      text: lines.join('\n'),
      level: 'l2'
    }
  ]
}

export const ziweiEngine: DivinationEngine<ZiweiInput, ZiweiResult> = {
  kind: ZIWEI_KIND,
  method: ZIWEI_METHOD,

  compute(input: ZiweiInput): ZiweiResult {
    // 定命宫 / 安星 / 四化 / 大限都是**确定性**（生年干 / 生月 / 生时决定），不需要随机源
    const fp = fourPillars(input)
    const yearGan = fp.year.gan
    // 紫微按**农历**生月 / 生日定命宫与起紫微（经 lunar-typescript 由公历换算；
    // 闰月按当月，口径待核校）；命宫公式本身对照 iztro 已核（见 crosscheck spec）
    const lunar = solarToLunar(input)
    const ming = determineMingGong(yearGan, Math.abs(lunar.month), input.hour)
    const zhuXing = arrangeZhuXing(lunar.day, ming.wuXingJu.number)
    const siHua = computeSiHua(yearGan)
    const daXian = computeDaXian(ming, yearGan, input.gender, ming.wuXingJu.number)
    const fuXing = arrangeFuXing({
      yearGan,
      branch: fp.year.zhi,
      hour: input.hour,
      lunarMonth: Math.abs(lunar.month)
    })
    // 三台/八座/恩光/天贵 需以 左辅/右弼/文昌/文曲 的落宫为起点（iztro 实测规则，见 zaYao.ts）
    const starAt = (name: string): DiZhi | undefined =>
      (Object.keys(fuXing) as DiZhi[]).find((z) => fuXing[z].includes(name))
    const zaYao = arrangeZaYao({
      yearGan,
      branch: fp.year.zhi,
      monthBranch: fp.month.zhi,
      hour: input.hour,
      lunarDay: Math.abs(lunar.day),
      lunarMonth: Math.abs(lunar.month),
      zuoFu: starAt('左辅'),
      youBi: starAt('右弼'),
      wenChang: starAt('文昌'),
      wenQu: starAt('文曲')
    })
    const liuNianYear = input.liuNianYear ?? new Date().getFullYear()
    const liuNian = computeLiuNian(ming, liuNianYear)
    // 小限：男顺女逆，一对应流年虚岁（iztro getAgeIndex 口诀）；未提供性别则不排
    if (input.gender) {
      const age = Math.max(1, liuNianYear - input.year + 1)
      const xiao = computeXiaoXian(ming, fp.year.zhi, input.gender, age)
      liuNian.xiaoXian = {
        ...xiao,
        age,
        direction: input.gender === 'male' ? 'forward' : 'backward',
        // 小限无可得第二源，维持 false（见 XIAO_XIAN_REVIEWED）
        reviewed: XIAO_XIAN_REVIEWED
      }
    }
    return {
      mingGong: ming,
      zhuXing,
      daXian,
      siHuaByPalace: siHuaByPalace(siHua, zhuXing.mainStars),
      fuXing,
      zaYao,
      liuNian,
      siHua,
      input
    }
  },

  interpret(r: ZiweiResult): Interpretation {
    const mg = r.mingGong
    const gongText = mg.twelveGong.map((g) => `${g.name}（${g.branch}）`).join('　')
    const dir = r.daXian.direction === 'forward' ? '顺行' : '逆行'

    const blocks: Interpretation['blocks'] = [
      {
        key: 'mingGong',
        label: '命宫',
        text: `${mg.ganZhi}（${mg.branch}宫）`,
        level: 'l3'
      },
      {
        key: 'wuXingJu',
        label: '五行局',
        text: `${mg.wuXingJu.label}`,
        level: 'l3'
      },
      {
        key: 'twelveGong',
        label: '十二宫（自命宫逆排）',
        text: gongText,
        level: 'l3'
      },
      {
        key: 'siHua',
        label: '四化（年干）',
        text: `禄→${r.siHua.lu}｜权→${r.siHua.quan}｜科→${r.siHua.ke}｜忌→${r.siHua.ji}（${r.siHua.yearGan}干，三合派）`,
        level: 'l3'
      },
      {
        key: 'siHuaPalace',
        label: '四化落宫',
        text: r.siHuaByPalace
          .map((p) => `${p.label}（${p.star}）${p.palace ? `${p.palace}宫` : '（落宫待定）'}`)
          .join('｜'),
        level: 'l3'
      },
      {
        key: 'juXing',
        label: '主星（14 正曜）',
        text: mg.twelveGong
          .map(
            (g) =>
              `${g.name}（${g.branch}）：${(r.zhuXing.mainStars[g.branch] ?? []).join('、') || '空'}`
          )
          .join('　'),
        level: 'l3'
      },
      {
        key: 'fuXing',
        label: '辅煞 / 杂曜',
        text: mg.twelveGong
          .map((g) => {
            const s = [...(r.fuXing[g.branch] ?? []), ...(r.zaYao[g.branch] ?? [])]
            return s.length ? `${g.name}（${g.branch}）：${s.join('、')}` : ''
          })
          .filter(Boolean)
          .join('　'),
        level: 'l3'
      },
      {
        key: 'daXian',
        label: '大限',
        text: r.daXian.needsGender
          ? '未提供性别，不排大限。'
          : `${dir}｜${r.daXian.startAge} 岁起限：${r.daXian.steps
              .map((s) => `${s.gongName}（${s.startAge}–${s.endAge}）`)
              .join('　')}`,
        level: 'l3'
      },
      {
        key: 'liuNian',
        label: '流年',
        text: `${r.liuNian.year} 年（${r.liuNian.gan}${r.liuNian.zhi}）｜流年命宫自 ${r.liuNian.zhi} 支起：${r.liuNian.gong
          .map((g) => `${g.name}@${g.branch}`)
          .join('　')}｜流年四化（${r.liuNian.gan}干）：禄${r.liuNian.siHua.lu} 权${r.liuNian.siHua.quan} 科${r.liuNian.siHua.ke} 忌${r.liuNian.siHua.ji}${r.liuNian.xiaoXian ? `\n小限（${r.liuNian.xiaoXian.direction === 'forward' ? '男顺' : '女逆'}，${r.liuNian.xiaoXian.age} 虚岁→${r.liuNian.xiaoXian.gongName}@${r.liuNian.xiaoXian.branch}）` : ''}`,
        level: 'l3'
      },
      {
        key: 'status',
        label: '状态',
        text: '本盘呈现命宫 / 五行局 / 十四正曜 / 辅煞 / 四化 / 大限 / 流年等排盘结构，生月与生日按农历换算；本盘不作命理解读，仅供参考。',
        level: 'l3'
      },
      ...palaceReferenceBlocks(mg, r.zhuXing.mainStars)
    ]

    return {
      title: `命宫 ${mg.ganZhi} · ${mg.wuXingJu.label}`,
      summary: `命宫 ${mg.ganZhi}｜${mg.wuXingJu.label}`,
      blocks,
      basis: {
        mingGong: mg,
        zhuXing: r.zhuXing,
        daXian: r.daXian,
        siHuaByPalace: r.siHuaByPalace,
        fuXing: r.fuXing,
        zaYao: r.zaYao,
        liuNian: r.liuNian,
        siHua: r.siHua,
        siHuaReviewed: SI_HUA_REVIEWED,
        policies: { ...ZIWEI_POLICIES },
        gongOrder: [...ZIWEI_GONG_ORDER]
      },
      degraded: ['zhuXing-unverified', 'siHua-unverified', 'calendarBasis'],
      school: '三合派'
    }
  }
}

registerEngine(ziweiEngine)

/** 组装一条可落库的紫微记录（供 store / 测试复用） */
export function buildZiweiRecord(input: ZiweiInput, id: string): ReadingRecord {
  const result = ziweiEngine.compute(input, { next: () => 0, int: () => 0 })
  return {
    id,
    kind: ZIWEI_KIND,
    method: ZIWEI_METHOD,
    schemaVersion: 1,
    dataVersion: currentDataVersion(),
    createdAt: Date.now(),
    input: { ...input },
    result: result as unknown as Record<string, unknown>,
    interpretation: ziweiEngine.interpret(result),
    // 出生数据是 PII：导出与分享一律剔除
    piiFields: ['input.at', 'input.place', 'input.gender']
  }
}

export { determineMingGong, ZIWEI_GONG_ORDER } from './palace'
export type { MingGongResult, ZiweiGongName } from './palace'
export { computeSiHua, SI_HUA_TABLE, SI_HUA_REVIEWED, ZIWEI_MAIN_STARS } from './siHua'
export type { SiHuaResult, SiHuaKind } from './siHua'
export { arrangeFuXing } from './fuXing'
export type { FuXingInput } from './fuXing'
export { arrangeZaYao } from './zaYao'
export type { ZaYaoInput } from './zaYao'
export { computeLiuNian, yearGanZhi } from './liuNian'
export type { LiuNianResult, LiuNianGong } from './liuNian'
export {
  arrangeZhuXing,
  ziWeiZhi,
  tianFuZhi,
  computeDaXian,
  siHuaByPalace
} from './zhuXing'
export type {
  ZhuXingResult,
  DaXianResult,
  DaXianStep,
  SiHuaToPalace,
  SiHuaToPalaceKind
} from './zhuXing'
