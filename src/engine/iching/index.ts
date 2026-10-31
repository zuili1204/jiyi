import { registerEngine } from '../registry'
import type {
  DivinationEngine,
  Interpretation,
  InterpretationBlock,
  InterpretContext,
  RandomSource
} from '../types'
import type { InputSchema } from '@/types/input'
import { currentDataVersion } from '@/platform/storage'
import type { ReadingRecord } from '@/types/reading'
import { castByCoins, castByNumbers, castByText, castByTime, type CastResult } from './cast'
import { meiHua, type MeiHuaResult } from './meiHua'
import { naJia, type NaJiaResult } from './naJia'
import { wangShuai, type WangShuaiResult } from './wangShuai'
import { liuYaoVerdict, type VerdictResult } from './verdict'
import { fourPillars, kongWang } from '../calendar'
import { TRIGRAM_BY_NAME, lineText, type Hexagram } from './constants'

/**
 * 卜筮引擎（Y3-03 起卦 / Y3-08 梅花体用互变）
 *
 * 两个子玩法：
 * - `iching.liujiao`：铜钱起卦（六爻）
 * - `iching.meihua`：梅花（时间 / 数字 / 字数)
 *
 * 纪律（与 lots 引擎同口径）：
 * - **卦辞 / 爻辞绝不硬编码**。母版（Y3-01/02）未装载时走 L3 兜底：
 *   只给卦名与**结构**（上下卦、动爻、变卦、互卦、体用），不编造任何卦爻辞与断语。
 * - 母版就绪后通过 `setIchingTextProvider` 注入，自动升级为 L1。
 */

export const ICHING_KIND = 'iching' as const
export const ICHING_METHOD_LIUJIAO = 'liujiao'
export const ICHING_METHOD_MEIHUA = 'meihua'

export interface IchingCoinInput {
  question?: string
  /**
   * 问占时刻（公历）。给了才算旺衰 —— 月建 / 日辰 / 旬空都由此推出。
   * 不传则只起卦装卦，不算旺衰（不做"看起来合理"的默认值）。
   */
  at?: { year: number; month: number; day: number; hour?: number; minute?: number }
}

export interface IchingMeihuaInput {
  type: 'time' | 'number' | 'text'
  question?: string
  /** type=time */
  year?: number
  month?: number
  day?: number
  hour?: number
  minute?: number
  /** type=number */
  a?: number
  b?: number
  /** type=text */
  text?: string
}

export interface IchingResult {
  cast: CastResult
  meihua?: MeiHuaResult
  /** 六爻装卦（Y3-06）：铜钱起卦时装配 */
  najia?: NaJiaResult
  /** 旺衰（Y3-07）：仅当传入问占时刻 `at` 时才计算 */
  wangshuai?: WangShuaiResult
}

/** 卦爻辞母版条目（由内容层注入；来自权威底本，须带 license） */
export interface IchingTextEntry {
  index: number
  name: string
  /** 卦辞（古籍原文） */
  ci?: string
  /** 大象（《象传》原文） */
  daXiang?: string
  /** 爻辞（自下而上 6 条，Y3-02） */
  yaoCi?: string[]
  /** 母版是否已过权威核校；false 时结果页必须提示 */
  reviewed?: boolean
  source: { name: string; license: string; note?: string }
}

export type IchingTextProvider = (index: number) => IchingTextEntry | undefined

let textProvider: IchingTextProvider | null = null

export function setIchingTextProvider(p: IchingTextProvider | null): void {
  textProvider = p
}

/**
 * 断语模板条目（Y3-09，由内容层注入；自撰白话，须带 license）。
 * 语义上只做**中性参考提示**，不构成吉凶断言。
 */
export interface IchingTemplateEntry {
  id: string
  key: string
  label: string
  text: string
  reviewed?: boolean
  source: { name: string; license: string }
}

/** 模板查询上下文：六爻用神得到模板、梅花体用关系模板、整体兜底 */
export interface IchingTemplateContext {
  yongShenKey?: string
  meihuaKey?: string
}

export type IchingTemplateProvider = (ctx: IchingTemplateContext) => IchingTemplateEntry[]

let templateProvider: IchingTemplateProvider | null = null

export function setIchingTemplateProvider(p: IchingTemplateProvider | null): void {
  templateProvider = p
}

/**
 * 义理解卦（Y3-04）：由内容层取「本卦 / 变卦 / 互卦」的自撰白话，
 * 供结果页生成解卦导读。缺源时降级（不猜）。
 */
export interface IchingYiLiEntry {
  guaContents: { index: number; name: string; baiHua?: string }[]
}

export type IchingYiLiProvider = (
  guaIndexes: { ben: number; bian?: number; hu?: number }
) => IchingYiLiEntry | undefined

let yiLiProvider: IchingYiLiProvider | null = null

export function setIchingYiLiProvider(p: IchingYiLiProvider | null): void {
  yiLiProvider = p
}

export const ICHING_SCHEMA_COIN: InputSchema = {
  fields: [{ key: 'question', label: '心中所问（可选）', type: 'text', required: false }]
}

function hexagramSymbol(h: Hexagram): string {
  const u = TRIGRAM_BY_NAME[h.upper].symbol
  const l = TRIGRAM_BY_NAME[h.lower].symbol
  return `${u}${l}`
}

function linesSymbol(lines: readonly boolean[]): string {
  return [...lines].reverse().map(lineText).join(' ')
}

function structureBlocks(r: IchingResult, ctx?: InterpretContext): InterpretationBlock[] {
  void ctx
  const { cast } = r
  const blocks: InterpretationBlock[] = [
    {
      key: 'benGua',
      label: '本卦',
      text: `第 ${cast.benGua.index} 卦 ${cast.benGua.name}（${hexagramSymbol(cast.benGua)}）：上${cast.benGua.upper}下${cast.benGua.lower}\n${linesSymbol(cast.lines)}`,
      level: 'l3'
    },
    {
      key: 'dongYao',
      label: '动爻',
      text: cast.dongYao.length ? `第 ${cast.dongYao.join('、')} 爻动` : '无动爻（静卦）',
      level: 'l3'
    }
  ]
  if (cast.bianGua) {
    blocks.push({
      key: 'bianGua',
      label: '变卦',
      text: `第 ${cast.bianGua.index} 卦 ${cast.bianGua.name}（${hexagramSymbol(cast.bianGua)}）`,
      level: 'l3'
    })
  }
  if (r.meihua) {
    blocks.push({
      key: 'huGua',
      label: '互卦',
      text: `第 ${r.meihua.huGua.index} 卦 ${r.meihua.huGua.name}`,
      level: 'l3'
    })
    blocks.push({
      key: 'tiYong',
      label: '体用',
      text: `体${r.meihua.ti.trigram}（${r.meihua.ti.element}）· 用${r.meihua.yong.trigram}（${r.meihua.yong.element}）→ ${r.meihua.relation}`,
      level: 'l3'
    })
    blocks.push(...meihuaVerdictBlocks(r.meihua.relation))
  }
  if (r.najia) blocks.push(...naJiaBlocks(r.najia))
  if (r.wangshuai) blocks.push(...wangShuaiBlocks(r.wangshuai))
  if (r.najia && r.wangshuai) blocks.push(...verdictBlocks(liuYaoVerdict(r.najia, r.wangshuai)))
  return blocks
}

/** 义理解卦块（Y3-04）：取本卦 / 变卦 / 互卦的自撰白话，拼成解卦导读 */
function yiLiReadingBlocks(r: IchingResult): InterpretationBlock[] {
  const guaIdx: { ben: number; bian?: number; hu?: number } = { ben: r.cast.benGua.index }
  if (r.cast.bianGua) guaIdx.bian = r.cast.bianGua.index
  if (r.meihua?.huGua) guaIdx.hu = r.meihua.huGua.index
  const rows = yiLiProvider?.(guaIdx)
  if (!rows) return []
  const parts: string[] = []
  for (const g of rows.guaContents) {
    parts.push(g.baiHua ? `${g.name}：${g.baiHua}` : `${g.name}卦`)
  }
  if (!parts.length) return []
  const labels: string[] = []
  if (rows.guaContents[0]) labels.push('本卦')
  if (r.cast.bianGua) labels.push('变卦')
  if (r.meihua?.huGua) labels.push('互卦')
  return [
    {
      key: 'yiliReading',
      label: '解卦导读（义理）',
      text: [`${labels.join(' · ')}：`, ...parts].join('\n'),
      level: 'l2'
    }
  ]
}

/**
 * taibu 独立计算源参考（波3）。
 * 判读措辞（旺衰 / 暗动 / 日破 / 旬空 / 用神三词 / 梅花体用断句）的词集合，
 * 均来自 DOCS/taibu-master 的 taibu-core@3.5.0（MIT）运行时实测采样：
 *   - DOCS/golden/taibu-liuyao.json   （六爻逐爻判读，node taibu-sample.mjs）
 *   - DOCS/golden/taibu-meihua.json   （梅花体用互变，node taibu-meihua-sample.mjs）
 *   - DOCS/golden/taibu-qimen.json    （奇门定局，node taibu-qimen-sample.mjs）
 * 这些是「可复现的独立计算源」，`reviewed:false`；用以**核对判词措辞**，
 * 不冒充权威 golden。结果页判读块与这些采样本一致——「待核验」标签指向此依据。
 */
export const TAIBU_REF_SOURCE = 'taibu-core@3.5.0（MIT）独立计算采样（reviewed:false）'

/** 梅花体用判句：taibu 梅花计算原句（Y3-09 模板未注入时的参照兜底） */
const MEIHUA_VERDICT: Record<string, { favor: boolean; phrase: string }> = {
  比和: { favor: true, phrase: '体脉比和，主相助相成；事态顺利。' },
  用生体: { favor: true, phrase: '用卦生体，主事情助我，吉。' },
  体克用: { favor: true, phrase: '体卦克用，主我能制事，吉。' },
  体生用: { favor: false, phrase: '体卦生用，主我去生事，多有耗泄。' },
  用克体: { favor: false, phrase: '用卦克体，主事情反制于我。' }
}

/** 用神强度词：taibu 三词原句（Y3-09 模板未装载时的参照兜底） */
const YONG_SHEN_LABEL: Record<'旺' | '衰' | '平', string> = {
  旺: '旺相可取',
  平: '平常可参',
  衰: '衰弱受制'
}

/**
 * 从内容层取梅花体用断句（Y3-09 模板）。模板未注入时退回 taibu 参照句并带「待核验」。
 */
function meihuaVerdictBlocks(relation: string): InterpretationBlock[] {
  const tpl = templateProvider?.({ meihuaKey: relation })[0]
  if (tpl) {
    return [
      { key: 'meihuaVerdict', label: tpl.label, text: `体用关系「${relation}」→ ${tpl.text}`, level: 'l2' },
      ...(tpl.reviewed === false
        ? [
            {
              key: 'meihuaVerdictCaveat',
              label: '说明',
              text: '体用断句为通行参考，仅供思考不作定论。',
              level: 'l3' as const
            }
          ]
        : [])
    ]
  }
  const v = MEIHUA_VERDICT[relation]
  if (!v) return []
  return [
    {
      key: 'meihuaVerdict',
      label: '梅花断语（参考）',
      text: `体用关系「${relation}」→ ${v.phrase}${v.favor ? '' : '（宜谨慎对待）'}`,
      level: 'l3'
    },
    {
      key: 'meihuaVerdictCaveat',
      label: '说明',
      text: '体用断语与通行判例一致，仅供参考、不作为定论。',
      level: 'l3'
    }
  ]
}

/**
 * 初版断语参照块（Y3-10）：判词引用 taibu（MIT）判读标签，仅作参照层——
 * 与排盘结构分离、必须带「待核验」可见，不冒充权威断语。
 */
function verdictBlocks(v: VerdictResult): InterpretationBlock[] {
  const lines = v.lines.map((l) =>
    `${l.position}爻 ${l.liuQin}（${l.zhi}）${l.role ? `[${l.role}]` : ''}：${l.tags.join('·')}`
  )
  const dong = v.dongYao.length ? `\n应期主轴：第 ${v.dongYao.join('、')} 爻（动爻）` : ''
  // 用神 = 世爻（测自身）或动爻对应的六亲；用一个与 YONG_SHEN_LABEL 对齐的简化判：取世爻强度词
  const level = v.lines.find((l) => l.role === '世')?.tags[0] as '旺' | '衰' | '平' | undefined
  const yongKey = level ?? undefined
  const tpl = templateProvider?.({ yongShenKey: yongKey })[0]
  if (tpl) {
    return [
      {
        key: 'verdict',
        label: `六爻判读 · ${tpl.label}`,
        text: lines.join('\n') + dong,
        level: 'l2'
      },
      {
        key: 'verdictTemplate',
        label: '用神提示',
        text: tpl.text,
        level: 'l2'
      },
      ...(tpl.reviewed === false
        ? [
            {
              key: 'verdictCaveat',
              label: '说明',
              text: '用神提示为通行参考，仅供思考不作定论。',
              level: 'l3' as const
            }
          ]
        : [])
    ]
  }
  // 模板未注入兜底：六爻判读各爻状态 + 用神三词（沿用 taibu）
  const firstYongLabel = level ? YONG_SHEN_LABEL[level] : undefined
  const text = `${lines.join('\n')}${dong}${firstYongLabel ? `\n用神${firstYongLabel}` : ''}`
  return [
    {
      key: 'verdict',
      label: '六爻判读（参考）',
      text,
      level: 'l3'
    },
    {
      key: 'verdictCaveat',
      label: '说明',
      text: `判读措辞与通行判例一致（${v.reviewed ? '已核验' : '待核验'}），仅作参考、不作定论。`,
      level: 'l3'
    }
  ]
}

/** 旺衰区块：只呈现**判定与依据**，不写断语（断语属 Y3-09 模板） */
function wangShuaiBlocks(w: WangShuaiResult): InterpretationBlock[] {
  const lines = w.yao.map(
    (y) =>
      `${y.position} 爻 ${y.zhi}${y.liuQin}：月${y.yue} 日${y.ri}` +
      `${y.yuePo ? ' 月破' : ''}${y.riChong === '暗动' ? ' 暗动' : ''}${
        y.riChong === '日破' ? ' 日破' : ''
      }${y.kongWang ? ' 旬空' : ''} → ${y.level}`
  )
  return [
    {
      key: 'wangShuaiMeta',
      label: '旺衰依据',
      text: `月建 ${w.yueZhi} · 日辰 ${w.riZhi}${w.kongWang.length ? ` · 旬空 ${w.kongWang.join('、')}` : ''}`,
      level: 'l3'
    },
    { key: 'wangShuai', label: '六爻旺衰', text: lines.join('\n'), level: 'l3' },
    ...(w.reviewed
      ? []
      : [
          {
            key: 'wangShuaiCaveat',
            label: '说明',
            text: '旺衰量化暂按通行口径呈现（《增删卜易》系统），仅作参考。',
            level: 'l3' as const
          }
        ])
  ]
}

const GENERATION_LABEL = ['本宫', '一世', '二世', '三世', '四世', '五世', '游魂', '归魂']

/** 装卦区块：只呈现**结构**（纳甲 / 六亲 / 世应），不含任何断语 */
function naJiaBlocks(n: NaJiaResult): InterpretationBlock[] {
  const lines = n.yao.map((y) => {
    const mark = y.shi ? ' [世]' : y.ying ? ' [应]' : ''
    const mv = y.moving && y.changed ? ` → ${y.changed.zhi}（${y.changed.liuQin}）` : ''
    return `${y.position} 爻 ${y.gan}${y.zhi} ${y.liuQin}${mark}${mv}`
  })
  return [
    {
      key: 'gong',
      label: '卦宫',
      text: `${n.gong}宫（${n.gongElement}）· ${GENERATION_LABEL[n.generation]} · 世在 ${n.shiYao} 爻 · 应在 ${n.yingYao} 爻`,
      level: 'l3'
    },
    { key: 'naJia', label: '纳甲六亲', text: lines.join('\n'), level: 'l3' },
    ...(n.reviewed
      ? []
      : [
          {
            key: 'naJiaCaveat',
            label: '说明',
            text: '装卦依据（京房纳甲八宫表）尚未过权威核验，结果仅供参考。',
            level: 'l3' as const
          }
        ])
  ]
}

/** 装卦结构（供结果页出纳甲表；只带结构与六亲，不含断语） */
function najiaBasis(n: NaJiaResult): Record<string, unknown> {
  return {
    gong: n.gong,
    gongElement: n.gongElement,
    generation: n.generation,
    shiYao: n.shiYao,
    yingYao: n.yingYao,
    yao: n.yao.map((y) => ({
      position: y.position,
      gan: y.gan,
      zhi: y.zhi,
      liuQin: y.liuQin,
      shi: y.shi,
      ying: y.ying,
      moving: y.moving,
      changed: y.changed ? { zhi: y.changed.zhi, liuQin: y.changed.liuQin } : undefined
    }))
  }
}

/** 旺衰分项（供结果页逐爻展示；分数口径本就是暂定的，这里只带分项与结论等级） */
function wangShuaiBasis(w: WangShuaiResult): Record<string, unknown> {
  return {
    yueZhi: w.yueZhi,
    riZhi: w.riZhi,
    kongWang: w.kongWang,
    yao: w.yao.map((y) => ({
      position: y.position,
      yue: y.yue,
      ri: y.ri,
      yuePo: y.yuePo,
      riChong: y.riChong,
      kongWang: y.kongWang,
      level: y.level
    }))
  }
}

/** 梅花体用互变结构（体用关系是梅花的核心，单独出图） */
function meihuaBasis(m: MeiHuaResult): Record<string, unknown> {
  return {
    ti: { trigram: m.ti.trigram, element: m.ti.element },
    yong: { trigram: m.yong.trigram, element: m.yong.element },
    relation: m.relation,
    huGua: { index: m.huGua.index, name: m.huGua.name }
  }
}

/**
 * 排盘依据（JY-02 §7）+ **卦象结构**。
 * 卦象结构进 `basis` 是为了让分享图版式 B（Y3-12）能只依赖 `Interpretation` 成图，
 * 从而保住「分享图绝不接触用户输入」这条硬约束。
 *
 * 装卦 / 旺衰 / 体用同样只进 `basis`：结果页与首页预览都能出图，
 * 且两者都只读 `Interpretation`，不额外接触用户输入。
 */
function basisOf(r: IchingResult): Record<string, unknown> {
  return {
    ...r.cast.basis,
    method: r.cast.method,
    dongYao: r.cast.dongYao,
    lines: r.cast.lines,
    benGua: {
      index: r.cast.benGua.index,
      name: r.cast.benGua.name,
      upper: r.cast.benGua.upper,
      lower: r.cast.benGua.lower
    },
    bianGua: r.cast.bianGua
      ? { index: r.cast.bianGua.index, name: r.cast.bianGua.name }
      : undefined,
    ...(r.najia ? { najia: najiaBasis(r.najia) } : {}),
    ...(r.wangshuai ? { wangShuai: wangShuaiBasis(r.wangshuai) } : {}),
    ...(r.meihua ? { meihua: meihuaBasis(r.meihua) } : {})
  }
}

/** 母版未装载时的 L3 兜底：只给结构，不编造卦爻辞 */
function fallbackInterpret(r: IchingResult, ctx?: InterpretContext): Interpretation {
  return {
    title: `第 ${r.cast.benGua.index} 卦 · ${r.cast.benGua.name}`,
    summary: `本卦 ${r.cast.benGua.name}${r.cast.bianGua ? `，之卦 ${r.cast.bianGua.name}` : ''}`,
    blocks: [
      ...structureBlocks(r, ctx),
      {
        key: 'pending',
        label: '状态',
        text: '卦辞与爻辞暂未收录，当前展示卦象结构与旺衰信息。',
        level: 'l3'
      }
    ],
    basis: basisOf(r),
    degraded: ['hexagram-text'],
    source: '通行卦辞（暂未收录）',
    school: '通行本'
  }
}

function withText(r: IchingResult, entry: IchingTextEntry, ctx?: InterpretContext): Interpretation {
  const blocks = structureBlocks(r, ctx)
  if (entry.daXiang) blocks.unshift({ key: 'daXiang', label: '象传', text: entry.daXiang, level: 'l1' })
  if (entry.ci) blocks.unshift({ key: 'ci', label: '卦辞', text: entry.ci, level: 'l1' })
  // 母版未过权威核校 → 必须可见（不骗用户，也不骗自己）
  if (entry.reviewed === false) {
    blocks.push({
      key: 'textCaveat',
      label: '说明',
      text: '卦辞与爻辞按通行版本呈现，仅供参考；尚未过权威版本核校。',
      level: 'l1'
    })
  }
  if (entry.yaoCi?.length) {
    for (const [i, t] of entry.yaoCi.entries()) {
      if (r.cast.dongYao.includes(i + 1) && t) {
        blocks.splice(blocks.length - 1, 0, {
          key: `yaoCi-${i + 1}`,
          label: `第 ${i + 1} 爻（动）`,
          text: t,
          level: 'l1'
        })
      }
    }
  }
  return {
    title: `第 ${entry.index} 卦 · ${entry.name}`,
    summary: entry.ci ?? entry.name,
    blocks,
    basis: basisOf(r),
    source: `${entry.source.name}:${entry.source.license}`,
    school: entry.source.note ?? 'default'
  }
}

function interpretCast(r: IchingResult, ctx?: InterpretContext): Interpretation {
  const entry = textProvider ? textProvider(r.cast.benGua.index) : undefined
  const base = entry ? withText(r, entry, ctx) : fallbackInterpret(r, ctx)
  // Y3-04 义理解卦：母版注入时在结构之后补充解卦导读
  const yi = yiLiReadingBlocks(r)
  if (yi.length) base.blocks.push(...yi)
  return base
}

export const ichingLiujiaoEngine: DivinationEngine<IchingCoinInput, IchingResult> = {
  kind: ICHING_KIND,
  method: ICHING_METHOD_LIUJIAO,
  compute(input: IchingCoinInput, rng: RandomSource): IchingResult {
    const cast = castByCoins(rng)
    const najia = naJia(cast)
    if (!input?.at) return { cast, najia }
    const p = fourPillars({
      year: input.at.year,
      month: input.at.month,
      day: input.at.day,
      hour: input.at.hour ?? 12,
      minute: input.at.minute ?? 0
    })
    return {
      cast,
      najia,
      wangshuai: wangShuai(najia, {
        yueZhi: p.month.zhi,
        riZhi: p.day.zhi,
        kongWang: [...kongWang(p.day)]
      })
    }
  },
  interpret: interpretCast
}

export const ichingMeihuaEngine: DivinationEngine<IchingMeihuaInput, IchingResult> = {
  kind: ICHING_KIND,
  method: ICHING_METHOD_MEIHUA,
  /**
   * 梅花起卦是**确定性**的（时间 / 数字 / 字数），不需要随机源。
   * `rng` 保留为可选参数，便于将来接入"随机取数"类玩法时不必改签名。
   */
  compute(input: IchingMeihuaInput, _rng?: RandomSource): IchingResult {
    let cast
    if (input.type === 'time') {
      if (
        input.year === undefined ||
        input.month === undefined ||
        input.day === undefined ||
        input.hour === undefined
      ) {
        throw new Error('时间起卦需要 year / month / day / hour')
      }
      cast = castByTime({
        year: input.year,
        month: input.month,
        day: input.day,
        hour: input.hour,
        minute: input.minute ?? 0
      })
    } else if (input.type === 'number') {
      if (input.a === undefined || input.b === undefined) throw new Error('数字起卦需要 a / b')
      cast = castByNumbers(input.a, input.b)
    } else {
      if (!input.text) throw new Error('字数起卦需要 text')
      // JY-08 拍板「字占加时辰」：动爻 = (总字数 + 时辰支) % 6，故 hour 必填
      if (input.hour === undefined) throw new Error('字数起卦需要时辰')
      cast = castByText(input.text, input.hour)
    }
    return { cast, meihua: meiHua(cast) }
  },
  interpret: interpretCast
}

registerEngine(ichingLiujiaoEngine)
registerEngine(ichingMeihuaEngine)

/** 组装一条可落库的卜筮记录 */
export function buildIchingRecord(
  input: IchingCoinInput | IchingMeihuaInput,
  rng: RandomSource,
  id: string,
  method: string = ICHING_METHOD_LIUJIAO
): ReadingRecord {
  const engine =
    method === ICHING_METHOD_MEIHUA
      ? (ichingMeihuaEngine as DivinationEngine<IchingMeihuaInput, IchingResult>)
      : (ichingLiujiaoEngine as DivinationEngine<IchingCoinInput, IchingResult>)
  const result = engine.compute(input as never, rng)
  return {
    id,
    kind: ICHING_KIND,
    method,
    schemaVersion: 1,
    dataVersion: currentDataVersion(),
    createdAt: Date.now(),
    input: { ...input },
    result: result as unknown as Record<string, unknown>,
    interpretation: engine.interpret(result),
    piiFields: []
  }
}
