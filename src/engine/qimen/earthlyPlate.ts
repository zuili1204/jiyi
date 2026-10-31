import type { Dun } from './constants'

/**
 * 地盘三奇六仪（Y6-02）
 *
 * 规则（JY-02 §6.5 第 4 步：戊己庚辛壬癸丁丙乙，阳遁顺布九宫、阴遁逆布）：
 * - 戊落哪一宫由**局数**定：n 局 → 戊起 n 宫（坎1 / 坤2 / 震3 / 巽4 / 中5 / 乾6 / 兑7 / 艮8 / 离9）；
 * - 阳遁顺行（宫数 +1 循环），阴遁逆行（宫数 −1 循环）。
 *
 * 纪律：这是**纯结构推导**，不写任何吉凶断语；九星 / 八门 / 八神（Y6-03/04）未落地前，
 * 结果只到"地盘九干"，不得冒充完整盘面。
 */

/** 洛书九宫数（地盘宫位编号即洛书数） */
export const PALACES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
export type Palace = (typeof PALACES)[number]

export const PALACE_NAME: Record<Palace, string> = {
  1: '坎',
  2: '坤',
  3: '震',
  4: '巽',
  5: '中',
  6: '乾',
  7: '兑',
  8: '艮',
  9: '离'
}

/** 阳遁布干次序：戊己庚辛壬癸丁丙乙（六仪在前、三奇在后） */
export const QI_YI_YANG = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'] as const

/** 阴遁布干次序：上述次序的逆行（戊起，其余逆排） */
export const QI_YI_YIN = ['戊', '乙', '丙', '丁', '癸', '壬', '辛', '庚', '己'] as const

export interface EarthlyPlate {
  dun: Dun
  ju: number
  /** 宫位 → 天干（九宫各一干，不重不漏） */
  cells: Record<Palace, string>
  /** 干 → 宫位（反查，便于 UI 与后续排天盘） */
  byGan: Record<string, Palace>
}

/** 宫数循环：把 1~9 之外的数折回 1~9 */
function wrap(n: number): Palace {
  return ((((n - 1) % 9) + 9) % 9 + 1) as Palace
}

/**
 * 排地盘九干。
 *
 * @param dun 阴阳遁
 * @param ju 局数 1~9（戊起始宫）
 */
export function earthlyPlate(dun: Dun, ju: number): EarthlyPlate | undefined {
  if (!Number.isInteger(ju) || ju < 1 || ju > 9) return undefined
  const seq = dun === 'yang' ? QI_YI_YANG : QI_YI_YIN
  const cells = {} as Record<Palace, string>
  const byGan: Record<string, Palace> = {}

  seq.forEach((gan, i) => {
    const palace = dun === 'yang' ? wrap(ju + i) : wrap(ju - i)
    cells[palace] = gan
    byGan[gan] = palace
  })

  return { dun, ju, cells, byGan }
}

/** 供 UI 展示：按宫序输出「宫名宫数：干」 */
export function plateLines(p: EarthlyPlate): string[] {
  return PALACES.map((n) => `${PALACE_NAME[n]}${n}：${p.cells[n]}`)
}
