import type { RandomSource } from '../types'
import { DI_ZHI, solarToLunar } from '../calendar'
import {
  hexagramByLines,
  TRIGRAM_BY_NAME,
  trigramByNumber,
  type Hexagram,
  type Line,
  type TrigramName
} from './constants'

/**
 * 起卦（Y3-03）
 *
 * 四种起卦法：铜钱（六爻）/ 时间 / 数字 / 字数（梅花）。
 *
 * 口径纪律（写死在注释里，避免后人各写一份）：
 * 1. **爻序自下而上**：下标 0 = 初爻，5 = 上爻；上卦 = 爻 4–6，下卦 = 爻 1–3。
 * 2. **铜钱法**：背 = 3、字 = 2，三枚之和定爻 ——
 *    6 = 老阴（动）、7 = 少阳（静）、8 = 少阴（静）、9 = 老阳（动）。
 *    奇数（7/9）为阳爻，偶数（6/8）为阴爻；**只有 6 / 9 是动爻**。
 * 3. **梅花数卦**：先天八卦数 乾1…坤8；`n % 8` 为 0 时取 **8**，`n % 6` 为 0 时取 **6**
 *    （这是余数为 0 的边界，JY-05 §3 明确要求覆盖）。
 * 4. 时间起卦用**农历**年支与月日、时辰支（公历 → 农历由历法底座负责）。
 */

export type YaoValue = 6 | 7 | 8 | 9

export interface Yao {
  /** 6 老阴 / 7 少阳 / 8 少阴 / 9 老阳 */
  value: YaoValue
  /** 阳爻 = true */
  yang: boolean
  moving: boolean
}

export type CastMethod = 'coin' | 'time' | 'number' | 'text'

export interface CastResult {
  method: CastMethod
  /** 本卦六爻，自下而上 */
  lines: Line[]
  /** 铜钱法的原始爻值（其余方法为推定值，仅用于表示动静） */
  yao: Yao[]
  /** 动爻位（1–6，自下而上） */
  dongYao: number[]
  benGua: Hexagram
  /** 有动爻才有变卦 */
  bianGua?: Hexagram
  bianLines?: Line[]
  /** 口径说明（让"为什么这么起卦"可追溯） */
  basis: Record<string, unknown>
}

/** 八卦数取模：0 → 8（余数为 0 的边界） */
export function mod8(n: number): number {
  const r = n % 8
  return r === 0 ? 8 : r
}

/** 动爻取模：0 → 6（余数为 0 的边界） */
export function mod6(n: number): number {
  const r = n % 6
  return r === 0 ? 6 : r
}

export function yaoFromValue(v: YaoValue): Yao {
  const yang = v === 7 || v === 9
  return { value: v, yang, moving: v === 6 || v === 9 }
}

/** 掷一次三枚铜钱（背 = 3，字 = 2） */
export function tossThreeCoins(rng: RandomSource): YaoValue {
  const sum = [0, 1, 2].reduce((acc) => acc + (rng.int(2) === 1 ? 3 : 2), 0)
  return sum as YaoValue
}

function build(method: CastMethod, yao: Yao[], basis: Record<string, unknown>): CastResult {
  const lines: Line[] = yao.map((y) => y.yang)
  const dongYao = yao
    .map((y, i) => (y.moving ? i + 1 : 0))
    .filter((n) => n > 0)
  const benGua = hexagramByLines(lines)
  const bianLines: Line[] | undefined = dongYao.length
    ? lines.map((l, i) => (dongYao.includes(i + 1) ? !l : l))
    : undefined
  return {
    method,
    lines,
    yao,
    dongYao,
    benGua,
    bianGua: bianLines ? hexagramByLines(bianLines) : undefined,
    bianLines,
    basis
  }
}

/** 铜钱起卦（六爻）：连掷六次成卦 */
export function castByCoins(rng: RandomSource): CastResult {
  const yao: Yao[] = []
  for (let i = 0; i < 6; i++) yao.push(yaoFromValue(tossThreeCoins(rng)))
  return build('coin', yao, {
    口径: '铜钱有字面记 2、背面记 3，六掷自下而上成卦；6 与 9 为动爻',
    爻值: yao.map((y) => y.value)
  })
}

/**
 * 数字起卦（梅花）：第一数为上卦、第二数为下卦、两数之和为动爻。
 */
export function castByNumbers(a: number, b: number): CastResult {
  if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error('数字起卦需要两个有效数字')
  const upper = trigramByNumber(mod8(Math.trunc(a)))
  const lower = trigramByNumber(mod8(Math.trunc(b)))
  const dong = mod6(Math.trunc(a) + Math.trunc(b))
  const yao = composeYao(upper.name, lower.name, dong)
  return build('number', yao, {
    口径: '按先天八卦数：第一数除以 8 的余数定上卦，第二数除以 8 的余数定下卦，两数之和除以 6 的余数定动爻；除尽时卦取 8、动爻取 6',
    上卦数: Math.trunc(a),
    下卦数: Math.trunc(b),
    动爻: dong
  })
}

/**
 * 时间起卦（梅花）：（年支 + 农历月 + 农历日）% 8 = 上卦；再加时辰支 % 8 = 下卦；
 * （年支 + 农历月 + 农历日 + 时支）% 6 = 动爻。
 *
 * ⚠️ **曾有的 bug（由 golden meihua-001/002 暴露）**：注释与 basis 都声明用农历月日，
 * 代码却取了传入的公历 `month/day`。golden 与 taibu-core@3.5 两源一致（001=山水蒙·动九二·体艮用坎、
 * 002=天水讼·动九四·体坎用乾），故此处以农历月日为准。
 * ⚠️ **闰月口径未定**：`solarToLunar` 的闰月为负值，此处取绝对值（闰二月按 2 算），
 * 该口径无 golden 覆盖，属显式简化，后续若采不同流派须另行登记。
 */
export function castByTime(d: {
  year: number
  month: number
  day: number
  hour: number
  minute?: number
}): CastResult {
  const lunar = solarToLunar({ ...d, minute: d.minute ?? 0 })
  const zhiChar = lunar.yearGanZhi.slice(-1)
  const yearZhi = (DI_ZHI as readonly string[]).indexOf(zhiChar) + 1 // 子 = 1
  if (yearZhi <= 0) throw new Error(`无法解析年支：${lunar.yearGanZhi}`)
  const hourZhi = hourToZhiIndex(d.hour) // 子 = 1
  const month = Math.abs(lunar.month)
  const day = lunar.day

  const upper = trigramByNumber(mod8(yearZhi + month + day))
  const lower = trigramByNumber(mod8(yearZhi + month + day + hourZhi))
  const dong = mod6(yearZhi + month + day + hourZhi)
  const yao = composeYao(upper.name, lower.name, dong)

  return build('time', yao, {
    口径: '农历年支数加月数、日数，除以 8 的余数定上卦；再加时辰支数，除以 8 的余数定下卦；总数除以 6 的余数定动爻；除尽时卦取 8、动爻取 6',
    农历年: lunar.yearGanZhi,
    年支序: yearZhi,
    农历月: lunar.month,
    农历日: lunar.day,
    时辰支序: hourZhi,
    动爻: dong
  })
}

/**
 * 字数起卦（梅花）：前段字数为上卦、后段字数为下卦、总字数为动爻。
 *
 * 口径说明：梅花字数起卦另有**笔画数法**，二者结果不同。
 * 首版采用字数法（简化、可复现），笔画数法待内容母版与流派核验后决定（另起决策）。
 */
/**
 * 字数起卦（梅花）：前段字数 → 上卦，后段字数 → 下卦，**(总字数 + 时辰支) → 动爻**。
 *
 * ⚠️ JY-08 已拍板「**字占加时辰**」（2026-09-23）：
 * 纯字数口径下「稽疑」2 字 → 动爻 2（九二），而 taibu-core@3.5 `text_split` 计入时辰午=7
 * 得 (1+1+7)=9%6=3（九三）。本项目采纳**加时辰**口径，故 `hour` 为**必填** ——
 * 缺失即抛错，不做默认值猜测（YR2：让口径与误差可见）。
 */
export function castByText(text: string, hour: number): CastResult {
  const chars = [...text].filter((c) => c.trim() !== '')
  if (chars.length === 0) throw new Error('字数起卦需要非空文本')
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
    throw new Error('字数起卦需要合法时辰（0–23）')
  }
  const half = Math.ceil(chars.length / 2)
  const a = half
  const b = chars.length - half
  const hourZhi = hourToZhiIndex(hour) // 子 = 1
  const upper = trigramByNumber(mod8(a))
  const lower = trigramByNumber(mod8(b))
  const dong = mod6(chars.length + hourZhi)
  const yao = composeYao(upper.name, lower.name, dong)
  return build('text', yao, {
    口径: '前段字数除以 8 的余数定上卦，后段字数除以 8 的余数定下卦，总字数加时辰数除以 6 的余数定动爻；除尽时卦取 8、动爻取 6',
    总字数: chars.length,
    前段: a,
    后段: b,
    时辰支序: hourZhi,
    动爻: dong
  })
}

/** 由上下卦 + 动爻位合成六爻（非动爻按卦象本爻，动爻位标记为动） */
function composeYao(upper: TrigramName, lower: TrigramName, dong: number): Yao[] {
  const lines: Line[] = [...TRIGRAM_BY_NAME[lower].lines, ...TRIGRAM_BY_NAME[upper].lines]
  return lines.map((l, i) => {
    const isDong = i + 1 === dong
    return {
      value: (l ? (isDong ? 9 : 7) : isDong ? 6 : 8) as YaoValue,
      yang: l,
      moving: isDong
    }
  })
}

/** 公历小时 → 时辰支序（子 = 1…亥 = 12） */
export function hourToZhiIndex(hour: number): number {
  if (hour < 0 || hour > 23) throw new Error(`小时非法：${hour}`)
  // 子时 23–01：拆成 0 点与 23 点两段
  if (hour === 23 || hour === 0) return 1
  const idx = Math.floor((hour + 1) / 2) + 1
  return idx > 12 ? 12 : idx
}
