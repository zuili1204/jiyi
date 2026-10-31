import { HEXAGRAMS, wuXingRelation, type Hexagram, type TrigramName, type WuXing } from './constants'
import type { CastResult } from './cast'

/**
 * 纳甲常量表 + 六爻装卦（Y3-05 / Y3-06；Y3-06 京房分宫纳甲修正，J8 拍板 1）
 *
 * 体系：**京房纳甲**（与 JY-01 §7「六爻 = 京房纳甲体系」一致）。
 *
 * ✅ **本表 `reviewed = true`（装卦层）**：2026-09-20 由 taibu-core@3.5.0（MIT，独立实现）
 * 对**全 64 卦 × 6 爻**逐爻做运行时核对（DOCS/golden/liu-verified-najia.json，
 * 复现 taibu-najia-all.mjs；tests/liujiao-najia-check.spec.ts 全量锁定）——
 * 宫/地支/六亲/世应 与独立引擎**完全一致**，故装卦判定为已核验；
 * 旺衰（wangShuai）与断语（verdict）仍各自 `reviewed:false`，不受此影响。
 *
 * 京房分宫纳甲规则（修正要点）：任意卦的地支 = **下卦八卦内三爻 + 上卦八卦外三爻**，
 * 天干内卦取下卦八卦 `inner`、外卦取上卦八卦 `outer`；世应仍按本宫世代。
 *
 * 结构不变量（已被单测锁死，能挡住大部分录入错误）：
 * - 八宫 × 8 卦 = 64 卦，恰好覆盖全部且**不重复**；
 * - 阳宫（乾震坎艮）纳**阳支**，阴宫（坤巽离兑）纳**阴支**；
 * - 每卦 6 个地支互不相同；
 * - 世应：本宫世六、一世世初、五世世五、游魂世四、归魂世三；应 = 世 + 3（模 6）。
 */

export const NA_JIA_SOURCE = '京房纳甲体系（八宫分宫法；与 taibu-core@3.5 双实现 64 卦一致）'
export const NA_JIA_REVIEWED = true

export type LiuQin = '父母' | '兄弟' | '子孙' | '妻财' | '官鬼'

export interface GongDef {
  /** 八宫卦（宫名即纯卦名） */
  name: TrigramName
  element: WuXing
  /** 阳宫 / 阴宫（决定纳阳支还是阴支） */
  yang: boolean
  /** 纳甲天干：内卦三爻 / 外卦三爻 */
  gan: { inner: string; outer: string }
  /** 纳支：自下而上 6 爻 */
  zhi: [string, string, string, string, string, string]
  /** 八宫卦序：本宫 → 一世 → …  → 五世 → 游魂 → 归魂 */
  order: string[]
}

/** 世爻位（与本表 order 一一对应）：本宫世六，游魂世四，归魂世三 */
export const SHI_POSITIONS = [6, 1, 2, 3, 4, 5, 4, 3] as const

export const GONGS: GongDef[] = [
  {
    name: '乾',
    element: '金',
    yang: true,
    gan: { inner: '甲', outer: '壬' },
    zhi: ['子', '寅', '辰', '午', '申', '戌'],
    order: ['乾', '姤', '遁', '否', '观', '剥', '晋', '大有']
  },
  {
    name: '兑',
    element: '金',
    yang: false,
    gan: { inner: '丁', outer: '丁' },
    zhi: ['巳', '卯', '丑', '亥', '酉', '未'],
    order: ['兑', '困', '萃', '咸', '蹇', '谦', '小过', '归妹']
  },
  {
    name: '离',
    element: '火',
    yang: false,
    gan: { inner: '己', outer: '己' },
    zhi: ['卯', '丑', '亥', '酉', '未', '巳'],
    order: ['离', '旅', '鼎', '未济', '蒙', '涣', '讼', '同人']
  },
  {
    name: '震',
    element: '木',
    yang: true,
    gan: { inner: '庚', outer: '庚' },
    zhi: ['子', '寅', '辰', '午', '申', '戌'],
    order: ['震', '豫', '解', '恒', '升', '井', '大过', '随']
  },
  {
    name: '巽',
    element: '木',
    yang: false,
    gan: { inner: '辛', outer: '辛' },
    zhi: ['丑', '亥', '酉', '未', '巳', '卯'],
    order: ['巽', '小畜', '家人', '益', '无妄', '噬嗑', '颐', '蛊']
  },
  {
    name: '坎',
    element: '水',
    yang: true,
    gan: { inner: '戊', outer: '戊' },
    zhi: ['寅', '辰', '午', '申', '戌', '子'],
    order: ['坎', '节', '屯', '既济', '革', '丰', '明夷', '师']
  },
  {
    name: '艮',
    element: '土',
    yang: true,
    gan: { inner: '丙', outer: '丙' },
    zhi: ['辰', '午', '申', '戌', '子', '寅'],
    order: ['艮', '贲', '大畜', '损', '睽', '履', '中孚', '渐']
  },
  {
    name: '坤',
    element: '土',
    yang: false,
    gan: { inner: '乙', outer: '癸' },
    zhi: ['未', '巳', '卯', '丑', '亥', '酉'],
    order: ['坤', '复', '临', '泰', '大壮', '夬', '需', '比']
  }
]

/** 地支六冲（子午、丑未、寅申、卯酉、辰戌、巳亥）—— 月破 / 日破 / 暗动判定用 */
export const LIU_CHONG: [string, string][] = [
  ['子', '午'],
  ['丑', '未'],
  ['寅', '申'],
  ['卯', '酉'],
  ['辰', '戌'],
  ['巳', '亥']
]

export function isChong(a: string, b: string): boolean {
  return LIU_CHONG.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
}

/** 地支五行 */
export const ZHI_WU_XING: Record<string, WuXing> = {
  亥: '水',
  子: '水',
  寅: '木',
  卯: '木',
  巳: '火',
  午: '火',
  申: '金',
  酉: '金',
  辰: '土',
  戌: '土',
  丑: '土',
  未: '土'
}

const YANG_ZHI = ['子', '寅', '辰', '午', '申', '戌']
const YIN_ZHI = ['丑', '卯', '巳', '未', '酉', '亥']

export function isYangZhi(zhi: string): boolean {
  return YANG_ZHI.includes(zhi)
}

export function zhiWuXing(zhi: string): WuXing {
  const w = ZHI_WU_XING[zhi]
  if (!w) throw new Error(`未知地支：${zhi}`)
  return w
}

export interface GongInfo {
  gong: GongDef
  /** 0 = 本宫，1–5 = 一世至五世，6 = 游魂，7 = 归魂 */
  generation: number
  shi: number
  ying: number
}

const GONG_INDEX = new Map<string, GongInfo>(
  GONGS.flatMap((gong) =>
    gong.order.map((name, i) => [
      name,
      {
        gong,
        generation: i,
        shi: SHI_POSITIONS[i],
        ying: ((SHI_POSITIONS[i] + 2) % 6) + 1
      }
    ] as [string, GongInfo])
  )
)

/** 卦名 → 所属宫 / 世应 */
export function gongOf(hexName: string): GongInfo {
  const info = GONG_INDEX.get(hexName)
  if (!info) throw new Error(`卦「${hexName}」不在八宫表中（数据缺失，拒绝猜测）`)
  return info
}

/**
 * 六亲：以**卦宫五行**为「我」。
 * 生我者父母、我生者子孙、克我者官鬼、我克者妻财、同我者兄弟。
 */
export function liuQin(me: WuXing, other: WuXing): LiuQin {
  switch (wuXingRelation(me, other)) {
    case '生':
      return '子孙' // 我生者
    case '克':
      return '妻财' // 我克者
    case '被生':
      return '父母' // 生我者
    case '被克':
      return '官鬼' // 克我者
    default:
      return '兄弟' // 同我者
  }
}

export interface YaoInfo {
  /** 1–6，自下而上 */
  position: number
  gan: string
  zhi: string
  wuXing: WuXing
  liuQin: LiuQin
  shi: boolean
  ying: boolean
  moving: boolean
  /** 动爻变出之爻（六亲仍以本宫五行为「我」） */
  changed?: { zhi: string; wuXing: WuXing; liuQin: LiuQin }
}

export interface NaJiaResult {
  benGua: Hexagram
  /** 所属宫 */
  gong: TrigramName
  gongElement: WuXing
  /** 本宫 / 一世 … 游魂 / 归魂 */
  generation: number
  shiYao: number
  yingYao: number
  yao: YaoInfo[]
  bianGua?: Hexagram
  /** 变卦各爻（地支同本宫体系，动爻取变后阴阳对应的支） */
  bianYao?: YaoInfo[]
  reviewed: boolean
  source: string
}

/** 变爻地支：动爻变阴阳后，取同宫序列中**该位**的支（阳支↔阴支互转） */
function changedZhi(zhi: string): string {
  const pool = isYangZhi(zhi) ? YANG_ZHI : YIN_ZHI
  const other = isYangZhi(zhi) ? YIN_ZHI : YANG_ZHI
  return other[pool.indexOf(zhi)]
}

/**
 * 京房八宫纳甲（分宫法，Y3-06 修正，J8 拍板 1）
 *
 * 正确规则：任意卦的六爻地支 = **本卦下卦八卦之「内三爻」 + 本卦上卦八卦之「外三爻」**，
 * 不再按「本宫整体一支序」推衍：
 *   - 内(初·2·3爻)：取 下卦八卦 所在宫 zhi[0..2]
 *   - 外（4·5·6爻）：取 上卦八卦 所在宫 zhi[3..5]
 * 天干同理：内卦取 下卦八卦 `gan.inner`，外卦取 上卦八卦 `gan.outer`
 * （仅乾(内甲/外壬)、坤(内乙/外癸) 内外不同，其余八卦内外同）。
 *
 * 由 taibu-core@3.5.0 运行时实测逐卦核对（DOCS/golden/liu-verified-najia.json，
 * tests/liujiao-najia-check.spec.ts）：世应 8/8 一致、首卦一致、本方法修正后
 * 八卦卦（屯蒙需讼既济归妹等）地支/六亲亦一致 —— `reviewed` 随之升级由 golden 复核决定。
 */
/** 六爻装卦：本卦 + 六亲 + 世应 + 动爻与变卦（京房分宫纳甲） */
export function naJia(cast: CastResult): NaJiaResult {
  const ben = cast.benGua
  const info = gongOf(ben.name)
  const g = info.gong // 本宫（决定世应与六亲之「我」，六亲仍以本宫五行为我）

  const innerGong = GONGS.find((x) => x.name === ben.lower)!
  const outerGong = GONGS.find((x) => x.name === ben.upper)!
  const zhiSeq = [...innerGong.zhi.slice(0, 3), ...outerGong.zhi.slice(3, 6)]

  const yao: YaoInfo[] = [0, 1, 2, 3, 4, 5].map((i) => {
    const zhi = zhiSeq[i]
    const wx = zhiWuXing(zhi)
    const moving = cast.dongYao.includes(i + 1)
    return {
      position: i + 1,
      gan: i < 3 ? innerGong.gan.inner : outerGong.gan.outer,
      zhi,
      wuXing: wx,
      liuQin: liuQin(g.element, wx),
      shi: i + 1 === info.shi,
      ying: i + 1 === info.ying,
      moving,
      changed: moving
        ? (() => {
            const cz = changedZhi(zhi)
            const cw = zhiWuXing(cz)
            return { zhi: cz, wuXing: cw, liuQin: liuQin(g.element, cw) }
          })()
        : undefined
    }
  })

  const bianYao = cast.bianGua
    ? yao.map((y) =>
        y.changed
          ? { ...y, zhi: y.changed.zhi, wuXing: y.changed.wuXing, liuQin: y.changed.liuQin }
          : { ...y }
      )
    : undefined

  return {
    benGua: ben,
    gong: g.name,
    gongElement: g.element,
    generation: info.generation,
    shiYao: info.shi,
    yingYao: info.ying,
    yao,
    bianGua: cast.bianGua,
    bianYao,
    reviewed: NA_JIA_REVIEWED,
    source: NA_JIA_SOURCE
  }
}

/** 供自检：八宫表是否恰好覆盖 64 卦 */
export function gongTableNames(): string[] {
  return GONGS.flatMap((g) => g.order)
}

export const ALL_HEXAGRAM_NAMES = HEXAGRAMS.map((h) => h.name)
