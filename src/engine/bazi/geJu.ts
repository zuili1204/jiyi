import {
  GAN_WU_XING,
  SHENG,
  KE,
  type DiZhi,
  type FourPillars,
  type TianGan,
  type WuXing
} from '@/engine/calendar'
import { shiShenOf, BRANCH_HIDDEN, type ShiShen } from './shiShen'

/**
 * 格局 + 五行分布 + 日主强弱（Y4-02，JY-02 §6.1 第 6/7 步的「格局」部分）
 *
 * 取格法（子平正格）：以**月令**所遁天干相对日主的十神定格
 * （正官格 / 七杀格 / 正财格 / 偏财格 / 正印格 / 偏印格 / 食神格 / 伤官格 /
 * 建禄格 / 月劫格）。
 *
 * 取格优先级（子平通行，简化版）：
 * - 月令藏干按 **本气 > 中气 > 余气** 顺序，优先取**在天干透出**且非比劫者；
 * - 若无透出非比劫，则取月令**本气**（本气为比劫 → 建禄 / 月劫格）。
 *
 * ⚠️ 简版（待核校，Y4-09）：
 * - 已计透干，但**未考虑**会局 / 三合 / 六合 / 外格 / 入库等变格；
 * - 日主强弱只做「得令（月令本气同类）+ 同类计数」的简版判断，
 *   不计地支藏干全量、不分旺相休囚死，更不排旺衰表。
 * 这些简化均在结果里**显式标注**，不冒充完整命盘。
 */

/** 地支藏干本气（主气；仅取其一，足够定月令本气十神） */
export const ZHI_BEN_QI: Record<DiZhi, TianGan> = {
  子: '癸',
  丑: '己',
  寅: '甲',
  卯: '乙',
  辰: '戊',
  巳: '丙',
  午: '丁',
  未: '己',
  申: '庚',
  酉: '辛',
  戌: '戊',
  亥: '壬'
}

/** 月令某层藏干十神 → 正格名 */
const GE_BY_SHI_SHEN: Record<ShiShen, string> = {
  正官: '正官格',
  七杀: '七杀格（偏官格）',
  正财: '正财格',
  偏财: '偏财格',
  正印: '正印格',
  偏印: '偏印格（枭神格）',
  食神: '食神格',
  伤官: '伤官格',
  比肩: '建禄格',
  劫财: '月劫格'
}

const HIDDEN_LAYER = ['本气', '中气', '余气'] as const

/* ------------------------------------------------------------------ 会局 / 合局 */

/** 三会方（方局，力量大于三合）：寅卯辰木、巳午未火、申酉戌金、亥子丑水 */
export const SAN_HUI_FANG: Array<{ members: DiZhi[]; wuXing: WuXing; name: string }> = [
  { members: ['寅', '卯', '辰'], wuXing: 'wood', name: '东方木局' },
  { members: ['巳', '午', '未'], wuXing: 'fire', name: '南方火局' },
  { members: ['申', '酉', '戌'], wuXing: 'metal', name: '西方金局' },
  { members: ['亥', '子', '丑'], wuXing: 'water', name: '北方水局' }
]

/** 三合局：亥卯未木、寅午戌火、巳酉丑金、申子辰水 */
export const SAN_HE_JU: Array<{ members: DiZhi[]; wuXing: WuXing; name: string }> = [
  { members: ['亥', '卯', '未'], wuXing: 'wood', name: '木三合局' },
  { members: ['寅', '午', '戌'], wuXing: 'fire', name: '火三合局' },
  { members: ['巳', '酉', '丑'], wuXing: 'metal', name: '金三合局' },
  { members: ['申', '子', '辰'], wuXing: 'water', name: '水三合局' }
]

/** 六合化气：子丑化土、寅亥化木、卯戌化火、辰酉化金、巳申化水、午未化土 */
export const LIU_HE_HUA: Record<DiZhi, { partner: DiZhi; wuXing: WuXing }> = {
  子: { partner: '丑', wuXing: 'earth' },
  丑: { partner: '子', wuXing: 'earth' },
  寅: { partner: '亥', wuXing: 'wood' },
  亥: { partner: '寅', wuXing: 'wood' },
  卯: { partner: '戌', wuXing: 'fire' },
  戌: { partner: '卯', wuXing: 'fire' },
  辰: { partner: '酉', wuXing: 'metal' },
  酉: { partner: '辰', wuXing: 'metal' },
  巳: { partner: '申', wuXing: 'water' },
  申: { partner: '巳', wuXing: 'water' },
  午: { partner: '未', wuXing: 'earth' },
  未: { partner: '午', wuXing: 'earth' }
}

/** 四库（辰戌丑未）：入库取格的库支 */
export const KU_ZHI: DiZhi[] = ['辰', '戌', '丑', '未']

/* ------------------------------------------------------------------ 十二长生 */

export const CHANG_SHENG_STAGES = [
  '长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'
] as const
export type ChangShengStage = (typeof CHANG_SHENG_STAGES)[number]

/** 地支顺序（与表内数组下标一致） */
const ZHI_ORDER: DiZhi[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

/**
 * 十二长生表：下标按 `ZHI_ORDER`（子丑寅卯辰巳午未申酉戌亥）。
 * 阳干顺行、阴干逆行（甲长生亥 / 乙长生午 / 丙戊长生寅 / 丁己长生酉 /
 * 庚长生巳 / 辛长生子 / 壬长生申 / 癸长生卯）。
 */
export const CHANG_SHENG: Record<TianGan, ChangShengStage[]> = {
  甲: ['沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养', '长生'],
  乙: ['病', '衰', '帝旺', '临官', '冠带', '沐浴', '长生', '养', '胎', '绝', '墓', '死'],
  丙: ['胎', '养', '长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝'],
  丁: ['绝', '墓', '死', '病', '衰', '帝旺', '临官', '冠带', '沐浴', '长生', '养', '胎'],
  戊: ['胎', '养', '长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝'],
  己: ['绝', '墓', '死', '病', '衰', '帝旺', '临官', '冠带', '沐浴', '长生', '养', '胎'],
  庚: ['死', '墓', '绝', '胎', '养', '长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病'],
  辛: ['长生', '养', '胎', '绝', '墓', '死', '病', '衰', '帝旺', '临官', '冠带', '沐浴'],
  壬: ['帝旺', '衰', '病', '死', '墓', '绝', '胎', '养', '长生', '沐浴', '冠带', '临官'],
  癸: ['临官', '冠带', '沐浴', '长生', '养', '胎', '绝', '墓', '死', '病', '衰', '帝旺']
}

/** 日主在某支的十二长生状态 */
export function changShengOf(gan: TianGan, zhi: DiZhi): ChangShengStage {
  return CHANG_SHENG[gan][ZHI_ORDER.indexOf(zhi)]
}

/* ------------------------------------------------------------------ 旺衰表 */

export type WangShuaiState = '旺' | '相' | '休' | '囚' | '死'

/** 得令分：旺 4 / 相 3 / 休 2 / 囚 1 / 死 0 */
export const WANG_SHUAI_SCORE: Record<WangShuaiState, number> = {
  旺: 4, 相: 3, 休: 2, 囚: 1, 死: 0
}

/**
 * 旺相休囚死：以**月令五行**为当令者，看日主五行相对状态。
 * 同我者旺 / 当令生我者相 / 我生当令者休 / 我克当令者囚 / 当令克我者死。
 */
export function wangShuaiStateOf(monthWx: WuXing, wx: WuXing): WangShuaiState {
  if (monthWx === wx) return '旺'
  if (SHENG[monthWx] === wx) return '相'
  if (SHENG[wx] === monthWx) return '休'
  if (KE[wx] === monthWx) return '囚'
  return '死' // 月令克我
}

/** 通根权重：本气 3 / 中气 2 / 余气 1；无根 0 */
export function rootWeightOf(dayMaster: TianGan, zhi: DiZhi): number {
  const hidden = BRANCH_HIDDEN[zhi]
  const i = hidden.indexOf(dayMaster)
  return i < 0 ? 0 : 3 - i
}

/** 生扶（印比）vs 克泄耗（官杀·财·食伤）分类 */
function isShengFu(s: ShiShen): boolean {
  return s === '比肩' || s === '劫财' || s === '正印' || s === '偏印'
}

export interface StrengthDetail {
  /** 得令：日主相对月令的旺相休囚死 */
  deLingState: WangShuaiState
  deLingScore: number
  /** 得地：四支通根（本气 3 / 中气 2 / 余气 1） */
  deDiScore: number
  deDiDetail: string[]
  /** 得势：天干生扶 − 克泄耗（不含日主） */
  deShiScore: number
  deShiDetail: string[]
  /** 十二长生（日主在四支） */
  changSheng: Array<{ zhi: DiZhi; stage: ChangShengStage }>
  /** 综合分（得令 + 得地 + 得势） */
  score: number
  /** 结论 */
  level: '极旺' | '身旺' | '偏旺' | '中和' | '偏弱' | '身弱' | '极弱'
  /** 分项说明（让口径可见） */
  reasons: string[]
}

/**
 * 日主强弱（旺衰表）：**得令 + 得地 + 得势** 三项综合。
 *
 * ⚠️ 口径（**暂定**，待 golden / 典籍核校）：阈值与权重无唯一权威做法，
 * 故分项与阈值全部随结果返回（`reasons`），不静默判定。
 */
export function computeStrength(p: FourPillars): StrengthDetail {
  const dm = p.day.gan
  const monthWx = GAN_WU_XING[ZHI_BEN_QI[p.month.zhi]]
  const dmWx = GAN_WU_XING[dm]

  // ① 得令
  const deLingState = wangShuaiStateOf(monthWx, dmWx)
  const deLingScore = WANG_SHUAI_SCORE[deLingState]

  // ② 得地（通根）
  const zhis: DiZhi[] = [p.year.zhi, p.month.zhi, p.day.zhi, p.time.zhi]
  const deDiDetail: string[] = []
  let deDiScore = 0
  for (const z of zhis) {
    const w = rootWeightOf(dm, z)
    if (w > 0) {
      deDiScore += w
      deDiDetail.push(`${z}支通根(${HIDDEN_LAYER[3 - w] ?? '有根'} +${w})`)
    }
  }

  // ③ 得势（天干，不含日主）
  const gans: TianGan[] = [p.year.gan, p.month.gan, p.time.gan]
  const deShiDetail: string[] = []
  let deShiScore = 0
  for (const g of gans) {
    const s = shiShenOf(dm, g)
    if (isShengFu(s)) {
      deShiScore += 1
      deShiDetail.push(`${g}(${s} 生扶 +1)`)
    } else {
      deShiScore -= 1
      deShiDetail.push(`${g}(${s} 克泄耗 -1)`)
    }
  }

  const changSheng = zhis.map((z) => ({ zhi: z, stage: changShengOf(dm, z) }))
  const score = deLingScore + deDiScore + deShiScore

  // 阈值（暂定口径，显式列出）
  const level: StrengthDetail['level'] =
    score >= 12 ? '极旺'
    : score >= 8 ? '身旺'
    : score >= 5 ? '偏旺'
    : score >= 3 ? '中和'
    : score >= 0 ? '偏弱'
    : score >= -4 ? '身弱'
    : '极弱'

  return {
    deLingState,
    deLingScore,
    deDiScore,
    deDiDetail,
    deShiScore,
    deShiDetail,
    changSheng,
    score,
    level,
    reasons: [
      `得令：月令${ZHI_BEN_QI[p.month.zhi]}(${monthWx}) → 日主${dm}(${dmWx})为「${deLingState}」+${deLingScore}`,
      `得地：${deDiDetail.length ? deDiDetail.join('、') : '无通根'} 合计 +${deDiScore}`,
      `得势：${deShiDetail.join('、') || '（仅日主）'} 合计 ${deShiScore >= 0 ? '+' : ''}${deShiScore}`,
      `综合 ${score} → ${level}（阈值：极旺≥12｜身旺8-11｜偏旺5-7｜中和3-4｜偏弱0-2｜身弱-4~-1｜极弱≤-5）`
    ]
  }
}

/** 专旺格（一行得气）名 */
const ZHUAN_WANG_GE: Record<WuXing, string> = {
  wood: '曲直仁寿格',
  fire: '炎上格',
  earth: '稼穑格',
  metal: '从革格',
  water: '润下格'
}

/** 会局 / 合局 / 入库 的结构化结果 */
export interface HuiJuInfo {
  kind: '三会方' | '三合局（成局）' | '三合局（半合）' | '六合'
  name: string
  wuXing: WuXing
  members: DiZhi[]
}

/** 扫描四支中的三会方 / 三合局 / 六合 */
export function findHuiJu(zhis: DiZhi[]): HuiJuInfo[] {
  const out: HuiJuInfo[] = []
  const set = new Set(zhis)

  for (const g of SAN_HUI_FANG) {
    if (g.members.every((m) => set.has(m))) {
      out.push({ kind: '三会方', name: g.name, wuXing: g.wuXing, members: [...g.members] })
    }
  }
  for (const g of SAN_HE_JU) {
    const hit = g.members.filter((m) => set.has(m))
    if (hit.length === 3) {
      out.push({ kind: '三合局（成局）', name: g.name, wuXing: g.wuXing, members: hit })
    } else if (hit.length === 2) {
      out.push({ kind: '三合局（半合）', name: g.name + '（半合）', wuXing: g.wuXing, members: hit })
    }
  }
  for (let i = 0; i < zhis.length; i++) {
    for (let j = i + 1; j < zhis.length; j++) {
      if (LIU_HE_HUA[zhis[i]].partner === zhis[j]) {
        out.push({
          kind: '六合',
          name: `${zhis[i]}${zhis[j]}合`,
          wuXing: LIU_HE_HUA[zhis[i]].wuXing,
          members: [zhis[i], zhis[j]]
        })
      }
    }
  }
  return out
}

/**
 * 外格判定：专旺（一行得气）/ 从格。
 * ⚠️ 暂定口径（同上）：阈值无唯一权威，分项随结果返回。
 */
export function findWaiGe(p: FourPillars, s: StrengthDetail): string | undefined {
  const dm = p.day.gan
  const dmWx = GAN_WU_XING[dm]
  const zhis: DiZhi[] = [p.year.zhi, p.month.zhi, p.day.zhi, p.time.zhi]
  const gans: TianGan[] = [p.year.gan, p.month.gan, p.day.gan, p.time.gan]

  // 专旺：四干四支本气中日主五行占比 ≥ 6/8，且身旺以上
  let dmCount = 0
  for (const g of gans) if (GAN_WU_XING[g] === dmWx) dmCount += 1
  for (const z of zhis) if (GAN_WU_XING[ZHI_BEN_QI[z]] === dmWx) dmCount += 1
  if (dmCount >= 6 && (s.level === '极旺' || s.level === '身旺')) {
    return `${ZHUAN_WANG_GE[dmWx]}（一行得气，同类 ${dmCount}/8）`
  }

  // 从格：极弱 / 身弱 且 无通根 且 天干无生扶
  const noRoot = s.deDiScore === 0
  const noShengFu = s.deShiDetail.every((d) => d.includes('克泄耗'))
  if ((s.level === '极弱' || s.level === '身弱') && noRoot && noShengFu) {
    // 取克泄耗中最旺的一类定从格
    const kinds = gans
      .filter((g) => g !== dm)
      .map((g) => shiShenOf(dm, g))
    const hasCai = kinds.some((k) => k === '正财' || k === '偏财')
    const hasSha = kinds.some((k) => k === '正官' || k === '七杀')
    const hasShi = kinds.some((k) => k === '食神' || k === '伤官')
    if (hasCai) return '从财格'
    if (hasSha) return '从官杀格'
    if (hasShi) return '从儿格'
  }
  return undefined
}

export interface GeJuResult {
  monthBranch: DiZhi
  monthBenQi: TianGan
  monthBenQiShiShen: ShiShen
  geJu: string
  /** 取格依据（月令本气 / 月令某气透干） */
  geJuBasis: string
  /** 五行分布（四干 + 四支本气，共 8 位） */
  wuXingDist: Record<WuXing, number>
  dayMasterWuXing: WuXing
  /** 得令：月令本气与日主同五行 */
  deLing: boolean
  /** 与日主同五行的位置数（天干 + 本气） */
  sameCount: number
  /** 强弱结论（旺衰表，见 `strengthDetail`） */
  strength: string
  /** 旺衰表：得令 / 得地 / 得势 / 综合 */
  strengthDetail: StrengthDetail
  /** 会局 / 三合 / 六合（四支扫描） */
  huiJu: HuiJuInfo[]
  /** 月支入库（辰戌丑未）时，库中透干情况 */
  kuInfo?: { zhi: DiZhi; touGan: TianGan[] }
  /** 外格（专旺 / 从格）；无则 undefined */
  waiGe?: string
  /** 口径备注 */
  note: string
}

export function computeGeJu(p: FourPillars): GeJuResult {
  const dm = p.day.gan
  const dayMasterWuXing = GAN_WU_XING[dm]

  const monthBranch = p.month.zhi
  const benQi = ZHI_BEN_QI[monthBranch]

  // 取格：月令藏干按 本气 > 中气 > 余气，优先取「天干透出」且非比劫者；
  // 无透出非比劫则取本气（本气比劫 → 建禄 / 月劫格）。
  const hidden = BRANCH_HIDDEN[monthBranch]
  const hiddenSS = hidden.map((g) => shiShenOf(dm, g))
  const tianGanSet = new Set<TianGan>([p.year.gan, p.month.gan, p.day.gan, p.time.gan])
  let chosen = -1
  for (let i = 0; i < hidden.length; i++) {
    const s = hiddenSS[i]
    if (s !== '比肩' && s !== '劫财' && tianGanSet.has(hidden[i])) {
      chosen = i
      break
    }
  }
  let geShiShen: ShiShen
  let geJuBasis: string
  if (chosen >= 0) {
    geShiShen = hiddenSS[chosen]
    geJuBasis = `月令${HIDDEN_LAYER[chosen]}透干（${hidden[chosen]}）`
  } else {
    geShiShen = hiddenSS[0]
    geJuBasis =
      hiddenSS[0] === '比肩' || hiddenSS[0] === '劫财'
        ? '月令本气（比劫，无透干）'
        : '月令本气'
  }
  const geJu = GE_BY_SHI_SHEN[geShiShen]

  // 五行分布：四柱天干 + 四柱地支本气
  const dist: Record<WuXing, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 }
  const gans: TianGan[] = [p.year.gan, p.month.gan, p.day.gan, p.time.gan]
  const zhis: DiZhi[] = [p.year.zhi, p.month.zhi, p.day.zhi, p.time.zhi]
  for (const g of gans) dist[GAN_WU_XING[g]] += 1
  for (const z of zhis) dist[GAN_WU_XING[ZHI_BEN_QI[z]]] += 1

  let sameCount = 0
  for (const g of gans) if (GAN_WU_XING[g] === dayMasterWuXing) sameCount += 1
  for (const z of zhis) if (GAN_WU_XING[ZHI_BEN_QI[z]] === dayMasterWuXing) sameCount += 1

  const deLing = GAN_WU_XING[benQi] === dayMasterWuXing

  // 旺衰表（得令 + 得地 + 得势）
  const strengthDetail = computeStrength(p)
  const strength =
    `${strengthDetail.level}（综合 ${strengthDetail.score}：` +
    `得令${strengthDetail.deLingState}+${strengthDetail.deLingScore}、` +
    `得地+${strengthDetail.deDiScore}、得势${strengthDetail.deShiScore >= 0 ? '+' : ''}${strengthDetail.deShiScore}）`

  // 会局 / 三合 / 六合
  const huiJu = findHuiJu(zhis)

  // 入库：月支为四库时，看库中藏干是否透出
  let kuInfo: GeJuResult['kuInfo']
  if (KU_ZHI.includes(monthBranch)) {
    const touGan = hidden.filter((g) => tianGanSet.has(g) && g !== dm)
    kuInfo = { zhi: monthBranch, touGan }
  }

  // 外格（专旺 / 从格）
  const waiGe = findWaiGe(p, strengthDetail)

  return {
    monthBranch,
    monthBenQi: benQi,
    monthBenQiShiShen: hiddenSS[0],
    geJu,
    geJuBasis,
    wuXingDist: dist,
    dayMasterWuXing,
    deLing,
    sameCount,
    strength,
    strengthDetail,
    huiJu,
    kuInfo,
    waiGe,
    note:
      '取格：月令本气 > 中气 > 余气，优先透干且非比劫者（子平正格）；' +
      '已补 会局（三会方 / 三合局 / 六合）/ 入库 / 外格（专旺·从格）与旺衰表（得令·得地·得势）。' +
      '⚠️ 强弱阈值与会局取用为**暂定口径**（无唯一权威做法），分项已随结果返回；' +
      '本模块整体 `reviewed:false`，待 golden（Y4-09）核校'
  }
}
