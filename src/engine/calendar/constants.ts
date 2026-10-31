/** 历法基础常量表（JY-02 §2 C6：数据小、易验证，自研实现） */

export const TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const
export const DI_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const

export type TianGan = (typeof TIAN_GAN)[number]
export type DiZhi = (typeof DI_ZHI)[number]

/** 五行 */
export const WU_XING = ['wood', 'fire', 'earth', 'metal', 'water'] as const
export type WuXing = (typeof WU_XING)[number]

export const WU_XING_LABEL: Record<WuXing, string> = {
  wood: '木',
  fire: '火',
  earth: '土',
  metal: '金',
  water: '水'
}

/** 天干五行（甲乙木、丙丁火、戊己土、庚辛金、壬癸水） */
export const GAN_WU_XING: Record<TianGan, WuXing> = {
  甲: 'wood',
  乙: 'wood',
  丙: 'fire',
  丁: 'fire',
  戊: 'earth',
  己: 'earth',
  庚: 'metal',
  辛: 'metal',
  壬: 'water',
  癸: 'water'
}

/** 地支五行（亥子水、寅卯木、巳午火、申酉金、辰戌丑未土） */
export const ZHI_WU_XING: Record<DiZhi, WuXing> = {
  子: 'water',
  丑: 'earth',
  寅: 'wood',
  卯: 'wood',
  辰: 'earth',
  巳: 'fire',
  午: 'fire',
  未: 'earth',
  申: 'metal',
  酉: 'metal',
  戌: 'earth',
  亥: 'water'
}

/** 天干阴阳：阳干（甲丙戊庚壬）为 true */
export const GAN_YANG: Record<TianGan, boolean> = {
  甲: true,
  乙: false,
  丙: true,
  丁: false,
  戊: true,
  己: false,
  庚: true,
  辛: false,
  壬: true,
  癸: false
}

/** 地支阴阳：子寅辰午申戌为阳 */
export const ZHI_YANG: Record<DiZhi, boolean> = {
  子: true,
  丑: false,
  寅: true,
  卯: false,
  辰: true,
  巳: false,
  午: true,
  未: false,
  申: true,
  酉: false,
  戌: true,
  亥: false
}

/** 六十甲子（程序生成，自洽可验证：60 项、无重复） */
export const JIA_ZI_60: string[] = Array.from({ length: 60 }, (_, i) => {
  const g = TIAN_GAN[i % 10]
  const z = DI_ZHI[i % 12]
  return `${g}${z}`
})

/** 纳音五行：每两组干支共一纳音，30 项 */
export const NA_YIN: readonly string[] = [
  '海中金', '炉中火', '大林木', '路旁土', '剑锋金',
  '山头火', '涧下水', '城头土', '白蜡金', '杨柳木',
  '泉中水', '屋上土', '霹雳火', '松柏木', '长流水',
  '沙中金', '山下火', '平地木', '壁上土', '金箔金',
  '覆灯火', '天河水', '大驿土', '钗钏金', '桑柘木',
  '大溪水', '沙中土', '天上火', '石榴木', '大海水'
]

/** 五行相生：A 生 B */
export const SHENG: Record<WuXing, WuXing> = {
  wood: 'fire',
  fire: 'earth',
  earth: 'metal',
  metal: 'water',
  water: 'wood'
}

/** 五行相克：A 克 B */
export const KE: Record<WuXing, WuXing> = {
  wood: 'earth',
  earth: 'water',
  water: 'fire',
  fire: 'metal',
  metal: 'wood'
}

/** 十二地支六合 */
export const LIU_HE: Record<DiZhi, DiZhi> = {
  子: '丑',
  丑: '子',
  寅: '亥',
  卯: '戌',
  辰: '酉',
  巳: '申',
  午: '未',
  未: '午',
  申: '巳',
  酉: '辰',
  戌: '卯',
  亥: '寅'
}

/** 六冲 */
export const LIU_CHONG: Record<DiZhi, DiZhi> = {
  子: '午',
  午: '子',
  丑: '未',
  未: '丑',
  寅: '申',
  申: '寅',
  卯: '酉',
  酉: '卯',
  辰: '戌',
  戌: '辰',
  巳: '亥',
  亥: '巳'
}

/** 二十四节气（节 = 月令分界；气 = 中气） */
export const JIE_QI_24 = [
  '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
  '立夏', '小满', '芒种', '夏至', '小暑', '大暑',
  '立秋', '处暑', '白露', '秋分', '寒露', '霜降',
  '立冬', '小雪', '大雪', '冬至', '小寒', '大寒'
] as const

/** 十二「节」（非中气）：八字换月的分界 */
export const JIE_12 = [
  '立春', '惊蛰', '清明', '立夏', '芒种', '小暑',
  '立秋', '白露', '寒露', '立冬', '大雪', '小寒'
] as const

/**
 * 支持区间（JY-02 §2）：超出必须硬拦截，不做"尽力算"。
 *
 * 下界曾为 1900；Y1-16 实测（见 `tests/qimen-zhanguo.spec.ts` 与历法带侦察）：
 *   - `Solar.fromYmd` 对 1853 起不抛错；
 *   - **节气时刻与日干支（定局 / 四柱依赖）由天文公式推导**，对 1900 前仍精确
 *     （实测 1853–1899 立春/夏至/冬至均可得、日干支自洽）；
 *   - 唯**农历月日/闰月**在 1900 前为库规则推算（非权威闰月表）——这正是原先卡 1900 的原因。
 * 因此下界放宽到 1850（覆盖《奇闻旨归·占险课》1853 起点），
 * 但**农历月日展示在 1900 前不保证权威**，禁作 golden / 断语依据。
 */
export const CALENDAR_MIN_YEAR = 1850
export const CALENDAR_MAX_YEAR = 2100

/**
 * 早晚子时口径（决策 J7 待定；映射为库实测，2026-09-15）
 * 库（lunar-typescript）语义：
 *   sect = 1 → 晚子时（23:00–24:00）**归次日**（日柱进一天）
 *   sect = 2 → 晚子时**归当日**（日柱不变）
 * 注意：之前文档曾写反，已按实际运行结果更正。
 */
export type MidnightPolicy = 1 | 2
export const DEFAULT_MIDNIGHT_POLICY: MidnightPolicy = 2

/** 换年口径（决策 J14）：lichun = 立春；zhengyue = 正月初一 */
export type NewYearPolicy = 'lichun' | 'zhengyue'
export const DEFAULT_NEW_YEAR_POLICY: NewYearPolicy = 'lichun'

/**
 * 精度声明（UI 可见，JY-02 §2）
 * 放在不依赖 lunar-typescript 的本文件，避免「关于/设置页」连带打包整个历法库。
 */
export const PRECISION_STATEMENT =
  `本应用历法支持 ${CALENDAR_MIN_YEAR}–${CALENDAR_MAX_YEAR} 年；` +
  `节气时刻由第三方历法库计算，并经多组历史用例核验，仅供参考。`
