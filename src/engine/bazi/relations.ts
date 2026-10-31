import type { FourPillars, TianGan, DiZhi } from '@/engine/calendar'
import { LIU_HE, LIU_CHONG } from '@/engine/calendar'

/**
 * 干支刑冲合害 + 神煞（旁参，Y4-08 待补项）
 *
 * 「刑冲合害」源自子平法的**干支关系结构**（六冲 / 六合 / 三合 / 三刑 / 天干五合），
 * 属排盘结构；「神煞」是另一套流传表，本项目八字主命理 J12 为「子平法、不混用神煞派」，
 * 故神煞仅作**独立参照块**展示，不进入取格 / 断语。
 *
 * ⚠️ 口径（待核校 Y4-09）：神煞表取「年支 / 日干」为主的通行版本，golden 未入库，
 * 故 results 带 `reviewed:false`，界面必须可见「待核校」。
 */

/**
 * ✅ **已转正（2026-09-23，`false → true`）** —— 仅限「刑冲合害 + 天干五合」这些**关系表**本身：
 * 1. golden `bazi-021/022`（六合 / 六冲）、`bazi-026`（五合）与
 *    **lunar-typescript 1.8.6 `LunarUtil`（HE_ZHI_6 / CHONG / HE_GAN_5）逐项一致**
 *    —— 本项目常量为手写、非取自 6tail，故构成有效第二源；
 * 2. `bazi-023/024/025`（六害 / 三合 / 三刑·自刑）6tail 未暴露对应表，
 *    以**典籍两源记载一致**为准（已如实标注第二源较弱）。
 *
 * ⚠️ **转正范围不含**：① 神煞（`computeShenSha`，仍 `待核校`）；②「半合是否同列三合」的
 *    口径（见 `bazi-027` note 与 JY-08）；③ 化气五行（引擎未导出，断言未覆盖）。
 */
export const RELATIONS_REVIEWED = true

/** 地支六合（已有）：子丑、寅亥、卯戌、辰酉、巳申、午未 */
export { LIU_HE }
/** 地支六冲（已有）：子午、丑未、寅申、卯酉、辰戌、巳亥 */
export { LIU_CHONG }

/** 三合局分组：各组三个地支 */
export const SAN_HE_GROUP: DiZhi[][] = [
  ['申', '子', '辰'],
  ['寅', '午', '戌'],
  ['巳', '酉', '丑'],
  ['亥', '卯', '未']
]

/** 三刑（互刑等）：寅巳申、丑戌未、子卯（无极之刑）、辰午酉亥（自刑） */
export const SAN_XING_PAIRS: Array<[DiZhi, DiZhi]> = [
  ['寅', '巳'], ['巳', '申'], ['申', '寅'],
  ['丑', '戌'], ['戌', '未'], ['未', '丑'],
  ['子', '卯'], ['卯', '子']
]

/** 自刑支：辰辰、午午、酉酉、亥亥 */
export const ZI_XING: DiZhi[] = ['辰', '午', '酉', '亥']

/** 六害 */
export const LIU_HAI: Record<DiZhi, DiZhi> = {
  子: '未', 丑: '午', 寅: '巳', 卯: '辰',
  申: '亥', 酉: '戌', 午: '丑', 未: '子',
  巳: '寅', 辰: '卯', 亥: '申', 戌: '酉'
}

/** 天干五合 */
export const WU_HE: Record<TianGan, TianGan> = {
  甲: '己', 己: '甲',
  乙: '庚', 庚: '乙',
  丙: '辛', 辛: '丙',
  丁: '壬', 壬: '丁',
  戊: '癸', 癸: '戊'
}

/** 天干五合——合并表示（如 甲己 → 「甲己合土」） */
const WU_HE_WX: Record<string, string> = {
  甲己: '土',
  乙庚: '金',
  丙辛: '水',
  丁壬: '木',
  戊癸: '火'
}

const PILLAR_NAME: Record<'year' | 'month' | 'day' | 'time', string> = {
  year: '年', month: '月', day: '日', time: '时'
}

export interface Pair {
  a: DiZhi | TianGan
  b: DiZhi | TianGan
  label: string
}

export interface RelationsResult {
  /** 天干五合：如「年干甲 ⇄ 月干己（土）」 */
  wuHe: Pair[]
  /** 地支六合 */
  liuHe: Pair[]
  /** 地支六冲 */
  liuChong: Pair[]
  /** 三合（组内出现 ≥2 支） */
  sanHe: Pair[]
  /** 三刑（含申辰午酉亥自刑） */
  xing: Pair[]
  /** 六害 */
  hai: Pair[]
  /** 关系表已转正（依据见 `RELATIONS_REVIEWED` 注释）；神煞不在本结果内，仍待核校 */
  reviewed: boolean
}

function uniquePairs<T extends { a: unknown; b: unknown }>(pairs: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const p of pairs) {
    const key = [p.a, p.b].sort().join('|')
    if (!seen.has(key)) {
      seen.add(key)
      out.push(p)
    }
  }
  return out
}

/** 计算四柱间的干支关系 */
export function computeRelations(p: FourPillars): RelationsResult {
  const cols: Array<{ name: string; z: DiZhi; gan: TianGan }> = [
    { name: PILLAR_NAME.year, z: p.year.zhi, gan: p.year.gan },
    { name: PILLAR_NAME.month, z: p.month.zhi, gan: p.month.gan },
    { name: PILLAR_NAME.day, z: p.day.zhi, gan: p.day.gan },
    { name: PILLAR_NAME.time, z: p.time.zhi, gan: p.time.gan }
  ]

  // 天干五合
  const wuHe: Pair[] = []
  for (let i = 0; i < cols.length; i++)
    for (let j = i + 1; j < cols.length; j++) {
      if (WU_HE[cols[i].gan] === cols[j].gan) {
        const key = [cols[i].gan, cols[j].gan].sort().join('')
        const w = WU_HE_WX[key]
        wuHe.push({ a: cols[i].gan, b: cols[j].gan, label: `${cols[i].name}干 ${cols[i].gan} ⇄ ${cols[j].name}干 ${cols[j].gan}（合${w}）` })
      }
    }

  // 地支两两：六合 / 六冲 / 三刑 / 六害
  const liuHe: Pair[] = []
  const liuChong: Pair[] = []
  const xing: Pair[] = []
  const hai: Pair[] = []
  // 三合统计
  const sanHe: Pair[] = []

  for (let i = 0; i < cols.length; i++)
    for (let j = i + 1; j < cols.length; j++) {
      const a = cols[i]
      const b = cols[j]
      if (LIU_HE[a.z] === b.z) liuHe.push({ a: a.z, b: b.z, label: `${a.name}支 ${a.z} ＝合 六合（${a.z}合）` })
      if (LIU_CHONG[a.z] === b.z) liuChong.push({ a: a.z, b: b.z, label: `${a.name}支 ${a.z} ⇄ ${b.name}支 ${b.z}（相冲）` })
      // 六害
      if (LIU_HAI[a.z] === b.z) hai.push({ a: a.z, b: b.z, label: `${a.name}支 ${a.z} 害 ${b.name}支 ${b.z}` })
      // 三刑 / 自刑
      if (SAN_XING_PAIRS.some(([x, y]) => (x === a.z && y === b.z) || (x === b.z && y === a.z)))
        xing.push({ a: a.z, b: b.z, label: `${a.name} ${a.z} 刑 ${b.name} ${b.z}` })
      if (a.z === b.z && ZI_XING.includes(a.z))
        xing.push({ a: a.z, b: b.z, label: `${a.name}与${b.name} ${a.z} 自刑` })
    }

  // 三合：对每个局统计四柱中的支
  for (const group of SAN_HE_GROUP) {
    const present = cols.filter((c) => group.includes(c.z))
    if (present.length >= 2) {
      const label = present.map((c) => `${c.name} ${c.z}`).join('、')
      sanHe.push({ a: present[0].z, b: present[1].z, label: `${[(group.join(' '))]} 三合 → 已在 ${label}` })
    }
  }

  return {
    wuHe: uniquePairs(wuHe),
    liuHe: uniquePairs(liuHe),
    liuChong: uniquePairs(liuChong),
    sanHe: uniquePairs(sanHe),
    xing: uniquePairs(xing),
    hai: uniquePairs(hai),
    reviewed: RELATIONS_REVIEWED
  }
}

/* ---------- 神煞（独立参照块） ---------- */

/** 禄神（日干） */
const LU_SHEN_DAYGAN: Record<TianGan, DiZhi> = {
  甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳',
  己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子'
}

/** 文昌（日干） */
const WEN_CHANG_DAYGAN: Record<TianGan, DiZhi> = {
  甲: '巳', 乙: '午', 丙: '申', 丁: '酉', 戊: '申',
  己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯'
}

/** 天乙贵人（日干） → 两位 */
const GUI_REN_DAYGAN: Record<TianGan, [DiZhi, DiZhi]> = {
  甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'],
  乙: ['子', '申'], 己: ['子', '申'],
  丙: ['亥', '酉'], 丁: ['亥', '酉'],
  壬: ['卯', '巳'], 癸: ['卯', '巳'],
  辛: ['午', '寅']
}

/** 桃花（咸池，年支） */
const TAO_HUA_YEARZHI: Record<DiZhi, DiZhi> = {
  寅: '卯', 午: '卯', 戌: '卯',
  申: '酉', 子: '酉', 辰: '酉',
  巳: '午', 酉: '午', 丑: '午',
  亥: '子', 卯: '子', 未: '子'
}

/** 驿马（年支） */
const YI_MA_YEARZHI: Record<DiZhi, DiZhi> = {
  申: '寅', 子: '寅', 辰: '寅',
  寅: '申', 午: '申', 戌: '申',
  巳: '亥', 酉: '亥', 丑: '亥',
  亥: '巳', 卯: '巳', 未: '巳'
}

/** 华盖（年支墓库） */
const HUA_GAI_YEARZHI: Record<DiZhi, DiZhi> = {
  子: '辰', 丑: '丑', 寅: '戌', 卯: '未',
  辰: '辰', 巳: '丑', 午: '戌', 未: '未',
  申: '辰', 酉: '丑', 戌: '戌', 亥: '未'
}

/* 以下扩展神煞表以 taibu-master `packages/core/src/data/shensha.ts`（MIT）为参照，均按年干 / 年支直接查表，无流派歧义。
　 原「禄神 / 文昌 / 天乙贵人 / 桃花 / 驿马 / 华盖」6 种经比对其表一致；以下补给常见常用种。 */

/** 羊刃（日干） */
const YANG_REN_DAYGAN: Record<TianGan, DiZhi> = {
  甲: '卯', 乙: '辰', 丙: '午', 丁: '未', 戊: '午',
  己: '未', 庚: '酉', 辛: '戌', 壬: '子', 癸: '丑'
}

/** 太极贵人（日干）→ 两位 */
const TAI_JI_DAYGAN: Record<TianGan, [DiZhi, DiZhi]> = {
  甲: ['子', '午'], 乙: ['子', '午'], 丙: ['卯', '酉'], 丁: ['卯', '酉'],
  戊: ['辰', '戌'], 己: ['辰', '戌'], 庚: ['寅', '亥'], 辛: ['寅', '亥'],
  壬: ['巳', '申'], 癸: ['巳', '申']
}

/** 劫煞（年支：三合所克之三合位） */
const JIE_SHA_YEARZHI: Record<DiZhi, DiZhi> = {
  寅: '亥', 午: '亥', 戌: '亥',
  申: '巳', 子: '巳', 辰: '巳',
  巳: '寅', 酉: '寅', 丑: '寅',
  亥: '申', 卯: '申', 未: '申'
}

/** 将星（年支：三合之旺位） */
const JIANG_XING_YEARZHI: Record<DiZhi, DiZhi> = {
  寅: '午', 午: '午', 戌: '午',
  申: '子', 子: '子', 辰: '子',
  巳: '酉', 酉: '酉', 丑: '酉',
  亥: '卯', 卯: '卯', 未: '卯'
}

/** 孤辰（年支：三合喜前之三支座） */
const GU_CHEN_YEARZHI: Record<DiZhi, DiZhi> = {
  寅: '巳', 卯: '巳', 辰: '巳',
  巳: '申', 午: '申', 未: '申',
  申: '亥', 酉: '亥', 戌: '亥',
  亥: '寅', 子: '寅', 丑: '寅'
}

/** 寡宿（年支：三合之后之三支座） */
const GUA_SU_YEARZHI: Record<DiZhi, DiZhi> = {
  寅: '丑', 卯: '丑', 辰: '丑',
  巳: '辰', 午: '辰', 未: '辰',
  申: '未', 酉: '未', 戌: '未',
  亥: '戌', 子: '戌', 丑: '戌'
}

/** 红鸾（年支） */
const HONG_LUAN_YEARZHI: Record<DiZhi, DiZhi> = {
  子: '卯', 丑: '寅', 寅: '丑', 卯: '子',
  辰: '亥', 巳: '戌', 午: '酉', 未: '申',
  申: '未', 酉: '午', 戌: '巳', 亥: '辰'
}

/** 天喜（年支） */
const TIAN_XI_YEARZHI: Record<DiZhi, DiZhi> = {
  子: '酉', 丑: '申', 寅: '未', 卯: '午',
  辰: '巳', 巳: '辰', 午: '卯', 未: '寅',
  申: '丑', 酉: '子', 戌: '亥', 亥: '戌'
}

export interface ShenSha {
  name: string
  branch: DiZhi
  pillar: string
}

/** 神煞：命中四柱地支里落到的神煞（仅列落地的） */
export function computeShenSha(p: FourPillars): ShenSha[] {
  const cols: Array<{ name: string; z: DiZhi }> = [
    { name: '年', z: p.year.zhi },
    { name: '月', z: p.month.zhi },
    { name: '日', z: p.day.zhi },
    { name: '时', z: p.time.zhi }
  ]
  const out: ShenSha[] = []
  const add = (name: string, target: DiZhi) => {
    for (const c of cols) if (c.z === target) out.push({ name, branch: target, pillar: c.name })
  }
  const dayGan = p.day.gan
  const yearZhi = p.year.zhi

  // 禄神 / 文昌 / 天乙贵人（日干）
  add('禄神', LU_SHEN_DAYGAN[dayGan])
  add('文昌', WEN_CHANG_DAYGAN[dayGan])
  for (const g of GUI_REN_DAYGAN[dayGan]) add('天乙贵人', g)
  // 桃花 / 驿马 / 华盖（年支）
  add('桃花', TAO_HUA_YEARZHI[yearZhi])
  add('驿马', YI_MA_YEARZHI[yearZhi])
  add('华盖', HUA_GAI_YEARZHI[yearZhi])
  // 补给：日干 羊刃 / 太极贵人
  add('羊刃', YANG_REN_DAYGAN[dayGan])
  for (const g of TAI_JI_DAYGAN[dayGan]) add('太极贵人', g)
  // 补给：年支 劫煞 / 将星 / 孤辰 / 寡宿 / 红鸾 / 天喜
  add('劫煞', JIE_SHA_YEARZHI[yearZhi])
  add('将星', JIANG_XING_YEARZHI[yearZhi])
  add('孤辰', GU_CHEN_YEARZHI[yearZhi])
  add('寡宿', GUA_SU_YEARZHI[yearZhi])
  add('红鸾', HONG_LUAN_YEARZHI[yearZhi])
  add('天喜', TIAN_XI_YEARZHI[yearZhi])

  return out
}