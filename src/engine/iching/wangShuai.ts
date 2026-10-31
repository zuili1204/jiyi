import { wuXingRelation, type WuXing } from './constants'
import { isChong, liuQin, zhiWuXing, type LiuQin, type NaJiaResult } from './naJia'

/**
 * 六爻旺衰（Y3-07）
 *
 * 体系：**《增删卜易》（野鹤老人）系统** —— J17 暂定（JY-08 §2 / §3），**待拍板转正**。
 *
 * ⚠️ 两条硬边界（别越界）：
 * 1. **本模块只判定旺衰，不写断语**。断语属内容母版（Y3-09），未装载时上层走 L3 兜底。
 * 2. **量化打分是暂定口径**（`reviewed: false`）。分项判定（月令 / 日辰 / 冲 / 空亡）是通行规则，
 *    但把它们合成一个分数没有唯一权威做法，所以：
 *    - 每一项都返回 **可解释的 `reasons`**（让误差可见，YR2）；
 *    - `score` / `level` 只作为**排序与提示**依据，不作为断语；
 *    - golden（`liujiao-007 / 008`）采集后必须校准。
 */

export const WANG_SHUAI_SOURCE = '《增删卜易》系统（J17 暂定，待拍板）'
export const WANG_SHUAI_REVIEWED = false

/** 月令状态：旺（同月令）/ 相（月令所生）/ 休（生月令）/ 囚（克月令）/ 死（月令所克） */
export type YueLingState = '旺' | '相' | '休' | '囚' | '死'

export type RiRelation = '生' | '克' | '同' | '泄' | '耗'

export type ChongState = '无' | '暗动' | '日破'

export type WangShuaiLevel = '旺' | '衰' | '平'

export interface WangShuaiYao {
  position: number
  zhi: string
  wuXing: WuXing
  liuQin: LiuQin
  /** 月令状态 */
  yue: YueLingState
  /** 日辰对爻的作用 */
  ri: RiRelation
  /** 月建冲爻 → 月破 */
  yuePo: boolean
  /** 日辰冲爻：旺相为暗动，休囚死为日破 */
  riChong: ChongState
  /** 旬空 */
  kongWang: boolean
  /** 综合（暂定口径） */
  score: number
  level: WangShuaiLevel
  /** 判定依据，逐条可解释 */
  reasons: string[]
}

export interface WangShuaiInput {
  /** 月建（月支） */
  yueZhi: string
  /** 日辰（日支） */
  riZhi: string
  /** 旬空地支（0~2 个） */
  kongWang?: string[]
}

export interface WangShuaiResult {
  yueZhi: string
  riZhi: string
  kongWang: string[]
  yao: WangShuaiYao[]
  reviewed: boolean
  source: string
}

/** 月令状态：以月令为「我」 */
export function yueLingState(yue: WuXing, yao: WuXing): YueLingState {
  switch (wuXingRelation(yue, yao)) {
    case '同':
      return '旺'
    case '生':
      return '相' // 月令生爻
    case '被生':
      return '休' // 爻生月令
    case '被克':
      return '囚' // 爻克月令
    default:
      return '死' // 月令克爻
  }
}

const YUE_SCORE: Record<YueLingState, number> = { 旺: 3, 相: 2, 休: 0, 囚: -1, 死: -2 }
const RI_SCORE: Record<RiRelation, number> = { 生: 2, 同: 1, 耗: 0, 泄: -1, 克: -2 }

/** 六爻旺衰：逐爻判定，返回可解释的分项与暂定综合分 */
export function wangShuai(najia: NaJiaResult, input: WangShuaiInput): WangShuaiResult {
  const yue = zhiWuXing(input.yueZhi)
  const ri = zhiWuXing(input.riZhi)
  const kong = input.kongWang ?? []

  const yao: WangShuaiYao[] = najia.yao.map((y) => {
    const wx = zhiWuXing(y.zhi)
    const yueS = yueLingState(yue, wx)
    const rel = wuXingRelation(ri, wx)
    const riR: RiRelation =
      rel === '生' ? '生' : rel === '克' ? '克' : rel === '同' ? '同' : rel === '被生' ? '泄' : '耗'

    const yuePo = isChong(input.yueZhi, y.zhi)
    const chongRi = isChong(input.riZhi, y.zhi)
    const isSheng = yueS === '旺' || yueS === '相'
    const riChong: ChongState = !chongRi ? '无' : isSheng ? '暗动' : '日破'
    const kongWang = kong.includes(y.zhi)

    const reasons: string[] = [`月令${yueS}（${input.yueZhi}月）`, `日辰${riR}`]
    let score = YUE_SCORE[yueS] + RI_SCORE[riR]
    if (yuePo) {
      score -= 3
      reasons.push('月破（月建冲爻）')
    }
    if (riChong === '暗动') {
      score += 1
      reasons.push('暗动（旺相逢日冲）')
    }
    if (riChong === '日破') {
      score -= 3
      reasons.push('日破（休囚逢日冲）')
    }
    if (kongWang) {
      score -= 2
      reasons.push('旬空')
    }

    return {
      position: y.position,
      zhi: y.zhi,
      wuXing: wx,
      liuQin: y.liuQin ?? liuQin(najia.gongElement, wx),
      yue: yueS,
      ri: riR,
      yuePo,
      riChong,
      kongWang,
      score,
      level: score >= 2 ? '旺' : score <= -2 ? '衰' : '平',
      reasons
    }
  })

  return {
    yueZhi: input.yueZhi,
    riZhi: input.riZhi,
    kongWang: kong,
    yao,
    reviewed: WANG_SHUAI_REVIEWED,
    source: WANG_SHUAI_SOURCE
  }
}
