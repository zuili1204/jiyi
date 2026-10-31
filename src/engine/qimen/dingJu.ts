import { fourPillars, jieQiTime, DI_ZHI, type DateTimeInput, type GanZhi } from '@/engine/calendar'
import { dingJuTerm, QIMEN_DINGJU_META, QIMEN_SAN_YUAN_RULE } from '@/data/content/qimen'
import { JIEQI_24, type Dun, type SanYuan } from './constants'

/**
 * 奇门定局（Y6-01 / JY-02 §6.5 第 1~3 步）
 *
 * 三步：定阴阳遁 → 定三元 → 定局数。
 *
 * 纪律：
 * - 阴阳遁按**节气**（冬至后夏至前阳遁、夏至后冬至前阴遁）—— 时家奇门口径。
 *   网上流传的刻家奇门写法是「看时支定阴阳遁、局数固定 174/936」，**不是同一套系统**，勿混；
 * - 三元按**日支**分组（拆补法口径），母版里记了规则与规格文档的出入；
 * - 局数**只查母版表**，代码里不写死任何局数；
 * - 母版 `reviewed = false`：结果必须带上「未过权威核校」标注，不得宣称权威。
 */

export interface DingJuResult {
  /** 问事时刻所处节气 */
  term: string
  dun: Dun
  yuan: SanYuan
  /** 局数 1~9 */
  ju: number
  dayGanZhi: string
  dayZhi: string
  /** 母版是否已过权威核校 */
  reviewed: boolean
}

/**
 * 取某时刻所处节气。
 *
 * 跨年边界（1 月的「小寒 / 大寒」属于上一年的节气序列、12 月的「冬至」可能在当年）
 * 必须把相邻年份的节气一起纳入，否则 1 月初会取不到节气。
 */
export function currentJieQi(d: DateTimeInput): string | undefined {
  const t = new Date(d.year, d.month - 1, d.day, d.hour ?? 12, d.minute ?? 0).getTime()
  const hits: { name: string; at: number }[] = []
  for (const y of [d.year - 1, d.year, d.year + 1]) {
    for (const n of JIEQI_24) {
      const at = jieQiTime(y, n)
      if (at) hits.push({ name: n, at: at.getTime() })
    }
  }
  hits.sort((a, b) => a.at - b.at)
  let cur: string | undefined
  for (const h of hits) {
    if (h.at <= t) cur = h.name
    else break
  }
  return cur
}

/** 六甲旬首地支：子午 → 上元 / 寅申 → 中元 / 辰戌 → 下元（符头法） */
function xunShouZhiOf(dayGanZhi: GanZhi): string {
  return DI_ZHI[(Math.floor(dayGanZhi.index / 10) * 10) % 12]
}

/**
 * 日柱 → 三元（**符头法**：日干支所属六甲旬的旬首地支）
 *
 * ⚠️ 2026-09-22 修正（golden qimen-001/002/003 抓到的**定局 defect**）：
 * 旧实现按「日支」分组（子午卯酉 / 寅申巳亥 / 辰戌丑未），与 taibu-core@3.5.0 及
 * 《烟波钓叟歌》体系的符头口径不符——5 例只对 1 例（002/003 直接错元）。
 * 正确口径：**符头**（甲子/甲午→上元、甲寅/甲申→中元、甲辰/甲戌→下元）。
 * 修正后与 taibu-core 逐例核对 3/3 一致（004/005 因节气交接日拆补细则存疑，未入库）。
 */
export function sanYuanOf(dayGanZhi: GanZhi): SanYuan | undefined {
  const zhi = xunShouZhiOf(dayGanZhi)
  const r = QIMEN_SAN_YUAN_RULE
  if (r.shang.includes(zhi)) return 'shang'
  if (r.zhong.includes(zhi)) return 'zhong'
  if (r.xia.includes(zhi)) return 'xia'
  return undefined
}

/**
 * 定局。任一步取不到值就返回 undefined —— **不猜默认值**
 * （YR2 同源：算不出来就说算不出来，而不是给一个看起来合理的局数）。
 */
export function dingJu(d: DateTimeInput): DingJuResult | undefined {
  const term = currentJieQi(d)
  if (!term) return undefined
  const t = dingJuTerm(term)
  if (!t) return undefined

  const pillars = fourPillars(d)
  const dayZhi = pillars.day.zhi
  const yuan = sanYuanOf(pillars.day)
  if (!yuan) return undefined

  return {
    term,
    dun: t.dun,
    yuan,
    ju: t[yuan],
    dayGanZhi: `${pillars.day.gan}${pillars.day.zhi}`,
    dayZhi,
    reviewed: QIMEN_DINGJU_META.reviewed
  }
}
