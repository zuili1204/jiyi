import {
  GAN_WU_XING,
  GAN_YANG,
  KE,
  SHENG,
  type FourPillars,
  type DiZhi,
  type TianGan,
  type WuXing
} from '@/engine/calendar'

/**
 * 十神（Y4-02，JY-02 §6.1 第 6 步）
 *
 * 以**日干为「我」**，按五行生克与阴阳异同定十神：
 * - 同我（同五行）：同阴阳 = 比肩，异阴阳 = 劫财
 * - 我生：同阴阳 = 食神，异阴阳 = 伤官
 * - 我克：同阴阳 = 偏财，异阴阳 = 正财
 * - 克我：同阴阳 = 七杀，异阴阳 = 正官
 * - 生我：同阴阳 = 偏印，异阴阳 = 正印
 *
 * 纪律：只算结构，不写断语；这套定义与 `JY-02 §6.1` 字面一致，golden 待采集（Y4-09）。
 */

export type ShiShen =
  | '比肩'
  | '劫财'
  | '食神'
  | '伤官'
  | '正财'
  | '偏财'
  | '正官'
  | '七杀'
  | '正印'
  | '偏印'

export interface ShiShenEntry {
  gan: TianGan
  /** 日干本身记「日主」，不取十神 */
  shiShen: ShiShen | '日主'
  wuXing: WuXing
}

export interface ShiShenResult {
  dayMaster: TianGan
  /** 四柱天干十神（年 / 月 / 日 / 时；日柱为日主） */
  byPillar: {
    year: ShiShenEntry
    month: ShiShenEntry
    day: ShiShenEntry
    time: ShiShenEntry
  }
  /** 四柱地支藏干十神（本气 / 中气 / 余气；相对日主） */
  byBranch: {
    year: CangGanEntry[]
    month: CangGanEntry[]
    day: CangGanEntry[]
    time: CangGanEntry[]
  }
}

/**
 * 地支藏干（本气 / 中气 / 余气，子平通行本）
 * 顺序：数组第 0 位为本气，其后为中气、余气。
 */
export const BRANCH_HIDDEN: Record<DiZhi, TianGan[]> = {
  子: ['癸'],
  丑: ['己', '癸', '辛'],
  寅: ['甲', '丙', '戊'],
  卯: ['乙'],
  辰: ['戊', '乙', '癸'],
  巳: ['丙', '戊', '庚'],
  午: ['丁', '己'],
  未: ['己', '丁', '乙'],
  申: ['庚', '壬', '戊'],
  酉: ['辛'],
  戌: ['戊', '辛', '丁'],
  亥: ['壬', '甲']
}

/** 一个地支的藏干（相对日主）十神列表，含「本 / 中 / 余」层级标记 */
export interface CangGanEntry extends ShiShenEntry {
  /** 本气 / 中气 / 余气 */
  layer: '本气' | '中气' | '余气'
}

export function cangGanShiShen(dayMaster: TianGan, zhi: DiZhi): CangGanEntry[] {
  const layers: CangGanEntry['layer'][] = ['本气', '中气', '余气']
  return BRANCH_HIDDEN[zhi].map((gan, i) => ({
    gan,
    shiShen: shiShenOf(dayMaster, gan),
    wuXing: GAN_WU_XING[gan],
    layer: layers[i] ?? '余气'
  }))
}

/** 一个「其他天干」相对日主的十神 */
export function shiShenOf(dayMaster: TianGan, other: TianGan): ShiShen {
  const dm = GAN_WU_XING[dayMaster]
  const o = GAN_WU_XING[other]
  const same = GAN_YANG[dayMaster] === GAN_YANG[other]
  if (dm === o) return same ? '比肩' : '劫财' // 同我
  if (SHENG[dm] === o) return same ? '食神' : '伤官' // 我生
  if (KE[dm] === o) return same ? '偏财' : '正财' // 我克
  if (KE[o] === dm) return same ? '七杀' : '正官' // 克我
  if (SHENG[o] === dm) return same ? '偏印' : '正印' // 生我
  // 五行仅五种，十干必落上述一种；到不了这里
  throw new Error(`十神无法归类：${dayMaster} / ${other}`)
}

function entry(dayMaster: TianGan, gan: TianGan): ShiShenEntry {
  return {
    gan,
    shiShen: shiShenOf(dayMaster, gan),
    wuXing: GAN_WU_XING[gan]
  }
}

export function computeShiShen(p: FourPillars): ShiShenResult {
  const dm = p.day.gan
  return {
    dayMaster: dm,
    byPillar: {
      year: entry(dm, p.year.gan),
      month: entry(dm, p.month.gan),
      day: { gan: dm, shiShen: '日主', wuXing: GAN_WU_XING[dm] },
      time: entry(dm, p.time.gan)
    },
    byBranch: {
      year: cangGanShiShen(dm, p.year.zhi),
      month: cangGanShiShen(dm, p.month.zhi),
      day: cangGanShiShen(dm, p.day.zhi),
      time: cangGanShiShen(dm, p.time.zhi)
    }
  }
}
