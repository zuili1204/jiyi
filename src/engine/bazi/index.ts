import { registerEngine } from '../registry'
import type { DivinationEngine, Interpretation } from '../types'
import type { InputSchema } from '@/types/input'
import type { ReadingRecord } from '@/types/reading'
import { currentDataVersion } from '@/platform/storage'
import { WU_XING_LABEL } from '@/engine/calendar'
import { baziPillars, pillarsText, type BaziInput, type BaziPillarsResult } from './pillars'
import { computeShiShen, type ShiShenResult, type ShiShen } from './shiShen'
import { computeGeJu, type GeJuResult } from './geJu'
import { computeDaYun, type DaYunResult } from './daYun'
import { computeRelations, computeShenSha, type RelationsResult, type ShenSha } from './relations'

/**
 * 参考性断语条目（由内容层注入；来自本产品自撰母版，须带 license）。
 * 语义上只做**中性参考提示**，不构成事实判断或吉凶断言（JY-04 §3）。
 */
export interface BaziDuanEntry {
  id: string
  title: string
  text: string
  /** 母版是否已过权威核校；false 时结果页必须提示 */
  reviewed?: boolean
  source: { name: string; license: string }
}

export interface BaziDuanContext {
  /** 强弱档：weak=true 偏弱；moderate=true 中和；都 false 视为偏强 */
  weak: boolean
  moderate: boolean
  /** 月干十神（取断语网格的关键索引） */
  monthShiShen: ShiShen | undefined
}

export type BaziDuanProvider = (ctx: BaziDuanContext) => BaziDuanEntry[]

let duanProvider: BaziDuanProvider | null = null

export function setBaziDuanProvider(p: BaziDuanProvider | null): void {
  duanProvider = p
}

/**
 * 八字引擎（Y4）
 *
 * ⚠️ 本品类的输入是**出生数据**（PII），必须先过独立同意流程（Y4-04）才能落盘。
 * 引擎层只负责"给定输入 → 排盘 + 十神 + 格局 + 大运"，同意与脱敏在 UI / 存储层。
 *
 * 纪律：
 * - Y4-01 四柱 + Y4-02 十神格局 + Y4-03 大运流年已落地；
 * - 只排结构，**不写命理解读 / 断语**（Y4-06 分项模板 / Y4-10 词表待做）；
 * - 三项口径都是暂定默认（J14 / J7 / J13），结果必须看得见、可核验；
 * - 取格 / 强弱为简版（仅月令本气、未排旺衰表），明确标注「待核校」；
 * - golden 未采集（Y0-04 / Y4-09），所以**不宣称正确**。
 */

export const BAZI_KIND = 'bazi' as const
export const BAZI_METHOD = 'sizhu'

/** 口径：均为暂定默认，拍板后须与 `JY-08` 字面一致 */
export const BAZI_POLICIES = {
  newYear: '立春', // J14
  midnight: '晚子时归当日', // J7（sect=2）
  leapMonth: '以节气为界分段', // J13
  reviewed: false
} as const

export const BAZI_SCHEMA: InputSchema = {
  fields: [
    {
      key: 'at',
      label: '出生时刻',
      type: 'datetime',
      required: true,
      pii: true,
      calendar: true,
      help: '公历时刻；换年按立春'
    },
    {
      key: 'place',
      label: '出生地',
      type: 'place',
      required: false,
      pii: true,
      help: '用于真太阳时订正；内置表未收录时不订正并提示手填经纬度'
    },
    {
      key: 'gender',
      label: '性别',
      type: 'gender',
      required: false,
      pii: true,
      help: '用于大运顺逆（阳男阴女顺行、阴男阳女逆行）；不填则大运暂不排，只给流年'
    }
  ]
}

/** 八字完整结果（四柱 + 十神 + 格局 + 大运） */
export interface BaziResult extends BaziPillarsResult {
  shiShen: ShiShenResult
  geJu: GeJuResult
  daYun: DaYunResult
  /** 干支刑冲合害 + 神煞（旁参） */
  relations: RelationsResult
  shenSha: ShenSha[]
}

export const baziEngine: DivinationEngine<BaziInput, BaziResult> = {
  kind: BAZI_KIND,
  method: BAZI_METHOD,

  compute(input: BaziInput): BaziResult {
    // 四柱是**确定性**的（时刻决定干支），不需要随机源
    const pillars = baziPillars(input)
    return {
      ...pillars,
      shiShen: computeShiShen(pillars.pillars),
      geJu: computeGeJu(pillars.pillars),
      daYun: computeDaYun(input, pillars),
      relations: computeRelations(pillars.pillars),
      shenSha: computeShenSha(pillars.pillars)
    }
  },

  interpret(r: BaziResult): Interpretation {
    const t = pillarsText(r.pillars)
    const ss = r.shiShen.byPillar
    const gj = r.geJu
    const dy = r.daYun

    const blocks: Interpretation['blocks'] = [
      { key: 'year', label: '年柱', text: t.year, level: 'l3' },
      { key: 'month', label: '月柱', text: t.month, level: 'l3' },
      { key: 'day', label: '日柱', text: t.day, level: 'l3' },
      { key: 'time', label: '时柱', text: t.time, level: 'l3' }
    ]

    if (r.trueSolar) {
      blocks.push({
        key: 'trueSolar',
        label: '真太阳时',
        text: `已订正 ${r.trueSolar.totalMinutes.toFixed(1)} 分钟（含均时差 ${r.trueSolar.eotMinutes.toFixed(1)}），订正后 ${r.trueSolar.correctedText}`,
        level: 'l3'
      })
    }
    if (r.placeUnresolved) {
      blocks.push({
        key: 'placeUnresolved',
        label: '真太阳时',
        text: `内置经度表未收录「${r.place}」，未做订正。请手填经纬度后再排盘 —— 不做近似替代。`,
        level: 'l3'
      })
    }

    // 十神（天干）
    blocks.push({
      key: 'shiShen',
      label: '十神（天干）',
      text:
        `日主 ${r.shiShen.dayMaster}｜` +
        `年干 ${ss.year.gan}→${ss.year.shiShen}｜` +
        `月干 ${ss.month.gan}→${ss.month.shiShen}｜` +
        `时干 ${ss.time.gan}→${ss.time.shiShen}`,
      level: 'l3'
    })

    // 格局 + 五行分布
    const dist = (Object.keys(gj.wuXingDist) as (keyof typeof gj.wuXingDist)[])
      .map((k) => `${WU_XING_LABEL[k]}${gj.wuXingDist[k]}`)
      .join(' ')
    blocks.push({
      key: 'geJu',
      label: '格局（月令取格）',
      text: `${gj.geJu}（取格：${gj.geJuBasis}；月支 ${gj.monthBranch} 本气 ${gj.monthBenQi}→${gj.monthBenQiShiShen}）｜五行分布：${dist}`,
      level: 'l3'
    })

    // 地支藏干十神
    const pillarName = { year: '年', month: '月', day: '日', time: '时' } as const
    const pillarKeys: (keyof typeof r.shiShen.byBranch)[] = ['year', 'month', 'day', 'time']
    const cangText = pillarKeys
      .map((pk) => {
        const br = r.shiShen.byBranch[pk]
        const zhi = r.pillars[pk].zhi
        const items = br.map((e) => `${e.gan}(${e.layer}→${e.shiShen})`).join(' ')
        return `${pillarName[pk]}支${zhi}：${items}`
      })
      .join('　')
    blocks.push({
      key: 'cangGan',
      label: '地支藏干十神',
      text: cangText,
      level: 'l3'
    })
    blocks.push({
      key: 'strength',
      label: '日主强弱（旺衰表）',
      text: `${gj.strength}\n${gj.strengthDetail.reasons.join('\n')}`,
      level: 'l3'
    })
    if (gj.huiJu.length) {
      blocks.push({
        key: 'huiJu',
        label: '会局 / 合局',
        text: gj.huiJu
          .map((h) => `${h.kind}：${h.name}（${h.members.join('、')}→${WU_XING_LABEL[h.wuXing]}）`)
          .join('　'),
        level: 'l3'
      })
    }
    if (gj.waiGe) {
      blocks.push({
        key: 'waiGe',
        label: '外格',
        text: `${gj.waiGe}（正格：${gj.geJu}）`,
        level: 'l3'
      })
    }
    if (gj.kuInfo) {
      blocks.push({
        key: 'ku',
        label: '入库',
        text:
          `月支 ${gj.kuInfo.zhi} 为四库；库中透干：` +
          (gj.kuInfo.touGan.length ? gj.kuInfo.touGan.join('、') : '（无透出）'),
        level: 'l3'
      })
    }

    // 大运
    if (dy.needsGender) {
      blocks.push({
        key: 'daYun',
        label: '大运',
        text: '未提供性别，无法定顺逆，暂不排大运（流年见下）。',
        level: 'l3'
      })
    } else if (dy.qiYun) {
      const dir = dy.direction === 'forward' ? '顺行' : '逆行'
      const qy = dy.qiYun
      blocks.push({
        key: 'daYun',
        label: '大运',
        text: `${dir}｜起运 ${qy.years} 岁 ${qy.months} 个月${qy.days ? ` ${qy.days} 日` : ''}`,
        level: 'l3'
      })
      const list = dy.steps
        .map((s) => {
          const start = s.startMonths ? `${s.startAge} 岁 ${s.startMonths} 个月` : `${s.startAge} 岁`
          return `${s.ganZhi}(${start}–${s.endAge} 岁)`
        })
        .join('　')
      blocks.push({ key: 'daYunSteps', label: '大运序列（8 步）', text: list, level: 'l3' })
    }

    // 流年
    if (dy.liuNian) {
      blocks.push({
        key: 'liuNian',
        label: '当前流年',
        text: `${dy.liuNian.year} 年（相对日主为 ${dy.liuNian.shiShen}）`,
        level: 'l3'
      })
    }

    // 干支刑冲合害（结构）
    const rel = r.relations
    const rels = [
      rel.liuChong.length && `六冲：${rel.liuChong.map((x) => x.label).join('｜')}`,
      rel.wuHe.length && `天干五合：${rel.wuHe.map((x) => x.label).join('｜')}`,
      rel.liuHe.length && `六合：${rel.liuHe.map((x) => x.label).join('｜')}`,
      rel.sanHe.length && `三合：${rel.sanHe.map((x) => x.label).join('｜')}`,
      rel.xing.length && `三刑/自刑：${rel.xing.map((x) => x.label).join('｜')}`,
      rel.hai.length && `六害：${rel.hai.map((x) => x.label).join('｜')}`
    ].filter(Boolean)
    blocks.push({
      key: 'relations',
      label: '刑冲合害',
      text: rels.length ? rels.join('　') : '四柱干支之间无明显对冲 / 刑 / 害关系。',
      level: 'l3'
    })

    // 神煞（独立参照，不混入子平取格）
    if (r.shenSha.length) {
      blocks.push({
        key: 'shenSha',
        label: '神煞（旁参）',
        text: r.shenSha.map((s) => `${s.name}@${s.pillar}(${s.branch})`).join('　'),
        level: 'l3'
      })
    }

    // 参考性断语（Y4-10 + Y4-06 分项模板）：由内容层 provider 注入，缺源时降级（不编造）
    const sLevel = gj.strengthDetail.level
    const duan = duanProvider
      ? duanProvider({
          weak: sLevel === '偏弱' || sLevel === '身弱' || sLevel === '极弱',
          moderate: sLevel === '中和',
          monthShiShen: ss.month.shiShen === '日主' ? undefined : ss.month.shiShen
        })
      : []
    for (const d of duan) {
      blocks.push({
        key: `duan-${d.id}`,
        label: d.title,
        text: d.text,
        level: 'l2'
      })
    }
    if (duan.length && duan.some((d) => d.reviewed === false)) {
      blocks.push({
        key: 'duanCaveat',
        label: '说明',
        text: '以上宜忌提示为通行参考，不作事实判断，仅供参考。',
        level: 'l3'
      })
    }

    blocks.push({
      key: 'policies',
      label: '口径',
      text: `换年：${BAZI_POLICIES.newYear}｜早晚子时：${BAZI_POLICIES.midnight}｜闰月：${BAZI_POLICIES.leapMonth}`,
      level: 'l3'
    })
    blocks.push({
      key: 'pending',
      label: '状态',
      text:
        '取格：月令本气 > 中气 > 余气、优先透干且非比劫者（子平正格），已计会局（三会方 / 三合局 / 六合）、入库、外格（专旺·从格）；' +
        '强弱已按旺衰表（得令·得地·得势），但强弱阈值与权重为暂定口径（无唯一权威做法，分项已随结果列出）。' +
        '大运起运按通行口径折算；刑冲合害关系表已核验。' +
        '本结果呈现排盘与强弱结构，不作命理断语，仅供参考。',
      level: 'l3'
    })

    const degraded: string[] = []
    if (dy.needsGender) degraded.push('daYun-needsGender')
    // 格局 / 强弱已非「简版」，但强弱阈值属暂定口径 → 如实标注
    degraded.push('strength-threshold-provisional', 'daYunRounding')

    return {
      title: `${t.year} 年 · ${t.month} 月 · ${t.day} 日 · ${t.time} 时`,
      summary: `四柱：${t.year} ${t.month} ${t.day} ${t.time}｜${gj.geJu}｜日主 ${r.shiShen.dayMaster}`,
      blocks,
      basis: {
        usedAt: r.usedAt,
        // 四柱原始结构：结果页的干支表 / 五行分布直接读它出图（不碰用户输入）
        pillars: r.pillars,
        trueSolar: r.trueSolar,
        placeUnresolved: r.placeUnresolved ?? false,
        policies: { ...BAZI_POLICIES },
        shiShen: r.shiShen,
        geJu: r.geJu,
        daYun: r.daYun,
        relations: r.relations,
        shenSha: r.shenSha,
        relationsReviewed: r.relations.reviewed
      },
      degraded,
      school: '子平法'
    }
  }
}

registerEngine(baziEngine)

export { computeRelations, computeShenSha } from './relations'
export type { RelationsResult, ShenSha } from './relations'

/** 组装一条可落库的八字记录（供 store / 测试复用） */
export function buildBaziRecord(input: BaziInput, id: string): ReadingRecord {
  const result = baziEngine.compute(input, { next: () => 0, int: () => 0 })
  return {
    id,
    kind: BAZI_KIND,
    method: BAZI_METHOD,
    schemaVersion: 1,
    dataVersion: currentDataVersion(),
    createdAt: Date.now(),
    input: { ...input },
    result: result as unknown as Record<string, unknown>,
    interpretation: baziEngine.interpret(result),
    // 出生数据是 PII：导出与分享一律剔除
    piiFields: ['input.at', 'input.place', 'input.gender']
  }
}

export { baziPillars, pillarsText } from './pillars'
export type { BaziInput, BaziPillarsResult, TrueSolarInfo } from './pillars'
export { computeShiShen, type ShiShenResult, type ShiShen, type ShiShenEntry, BRANCH_HIDDEN, cangGanShiShen, type CangGanEntry } from './shiShen'
export { computeGeJu, type GeJuResult, ZHI_BEN_QI } from './geJu'
export { computeDaYun, type DaYunResult, type DaYunStep } from './daYun'
