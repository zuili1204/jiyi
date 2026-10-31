/**
 * 品类元数据唯一权威源（JY-14 T3-1）
 *
 * 首页 `HomeView` 与教程页 `TutorialView` **同源引用**，避免两份 desc/name 漂移。
 * 归类：占卜玩法 keys 对齐 JY-01 §1 品类矩阵；`ready` 如实反映上线状态。
 */
export const CATEGORIES = [
  { key: 'lots', name: '签占', desc: '观音 / 关帝 / 吕祖', ready: true },
  { key: 'liujiao', name: '六爻', desc: '铜钱起卦 · 纳甲装卦', ready: true },
  { key: 'meihua', name: '梅花', desc: '时间 / 数字 / 字数', ready: true },
  { key: 'bazi', name: '八字', desc: '四柱 · 十神 · 大运', ready: true },
  { key: 'ziwei', name: '紫微', desc: '定命宫 · 五行局 · 四化', ready: true },
  { key: 'qimen', name: '奇门', desc: '定局 · 九宫 · 神煞', ready: true }
] as const

export type CategoryKey = (typeof CATEGORIES)[number]['key']