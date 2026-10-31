/**
 * 奇门常量（Y6-01）
 *
 * 纪律：
 * - 局数表**不写死在这里**，一律取自内容母版 `DOCS/content/qimen/dingJu.json`
 *   （与签文 / 卦爻辞同口径：原文与口诀归母版，代码只做查表与推导）；
 * - 定局法为 J6 **暂定默认**的拆补法，正式拍板前结果页必须标注「定局法待拍板」。
 */

export const QIMEN_KIND = 'qimen' as const
export const QIMEN_METHOD_CHAIBU = 'chaibu'

/** 二十四节气（自立春起的循环顺序，便于按时间排序取「当前节气」） */
export const JIEQI_24 = [
  '立春',
  '雨水',
  '惊蛰',
  '春分',
  '清明',
  '谷雨',
  '立夏',
  '小满',
  '芒种',
  '夏至',
  '小暑',
  '大暑',
  '立秋',
  '处暑',
  '白露',
  '秋分',
  '寒露',
  '霜降',
  '立冬',
  '小雪',
  '大雪',
  '冬至',
  '小寒',
  '大寒'
] as const

/** 三元（拆补法按日支分组，见母版 sanYuanRule） */
export type SanYuan = 'shang' | 'zhong' | 'xia'

export const SAN_YUAN_LABEL: Record<SanYuan, string> = {
  shang: '上元',
  zhong: '中元',
  xia: '下元'
}

/** 阴阳遁 */
export type Dun = 'yang' | 'yin'

export const DUN_LABEL: Record<Dun, string> = {
  yang: '阳遁',
  yin: '阴遁'
}

/**
 * 九宫 → 后天八卦方位（Y6-06 择方所需）。
 *
 * 纪律：这是**结构事实**（洛书九宫配后天八卦），不是断语；
 * 中宫不主方位，如实标注，不按「寄坤」等派门口径静默处理（JY-08 §4）。
 */
export const PALACE_DIRECTION: Record<number, string> = {
  1: '北方（坎宫）',
  2: '西南（坤宫）',
  3: '东方（震宫）',
  4: '东南（巽宫）',
  5: '中宫（不主方位）',
  6: '西北（乾宫）',
  7: '西方（兑宫）',
  8: '东北（艮宫）',
  9: '南方（离宫）'
}
