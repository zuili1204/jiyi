import type { GanZhi, DiZhi } from '@/engine/calendar'
import { kongWang } from '@/engine/calendar'
import { earthlyPlate, PALACES, type EarthlyPlate, type Palace } from './earthlyPlate'
import type { Dun } from './constants'

/**
 * 八神 / 空亡 / 马星（Y6-04）
 *
 * ⚠️ **待核校**（`reviewed = false`）：八神排布与空亡取「时旬」还是「日旬」、马星取「时支」
 * 均为转盘奇门通行做法，未与权威典籍逐条核对（golden Y6-08 未采集）。取法全部写在 `notes`
 * 里随结果返回，不做静默选择。
 */

/**
 * 八神（小值符随值符，余神依序；阳遁顺、阴遁逆）
 *
 * ✅ **口径已定（J21 决议，2026-09-24）：采主流常见序** ——
 * 值符·螣蛇·太阴·六合·白虎·玄武·九地·九天。
 *
 * ⚠️ **已登记的两点口径说明（不静默选择）**：
 * 1. **阴阳遁是否分表存疑**：部分文献阳遁用「勾陈·朱雀」、阴遁用「白虎·玄武」；
 *    本项目**暂不分表**，阴阳遁共用本表，并在 `notes` 中明示。
 * 2. **与 taibu-core 次序不同**（其 qimen-004 为 值符→六合→九地→太阴→九天→白虎→玄武→螣蛇），
 *    已登记为已知第三方分歧、**不采**。
 */
export const BA_SHEN = ['值符', '螣蛇', '太阴', '六合', '白虎', '玄武', '九地', '九天'] as const

/**
 * ✅ **盘面（九星 / 八门 / 八神 / 空亡 / 驿马）已转正（2026-09-24）**
 * 依据 golden `qimen-004 / 005`：定局（符头法，J20）、地盘天盘、值符值使、九宫星门干、
 * 空亡、驿马、**八神排布**均已断言通过；八神次序按 J21 决议口径。
 * ⚠️ 转正不含：八神「阴阳遁分表」存疑项（见 `BA_SHEN` 注释）、以及问事解读（Y6-06 未做）。
 */
export const QIMEN_PAN_REVIEWED = true

/** 十二地支 → 洛书本宫（子坎1、丑寅艮8、卯震3、辰巳巽4、午离9、未申坤2、酉兑7、戌亥乾6） */
export const ZHI_PALACE: Record<DiZhi, Palace> = {
  子: 1,
  丑: 8,
  寅: 8,
  卯: 3,
  辰: 4,
  巳: 4,
  午: 9,
  未: 2,
  申: 2,
  酉: 7,
  戌: 6,
  亥: 6
}

/** 驿马：时支三合局 → 马星地支（申子辰→寅、寅午戌→申、巳酉丑→亥、亥卯未→巳） */
const MA_XING_RULE: Record<DiZhi, DiZhi> = {
  申: '寅',
  子: '寅',
  辰: '寅',
  寅: '申',
  午: '申',
  戌: '申',
  巳: '亥',
  酉: '亥',
  丑: '亥',
  亥: '巳',
  卯: '巳',
  未: '巳'
}

/**
 * 天盘 / 值符值使 / 八门（Y6-03）
 *
 * 步骤（JY-02 §6.5 第 5~8 步）：
 *  1. 由**时柱干支**定旬首（六甲）→ 旬首遁的六仪 → 该六仪在地盘的宫 = 旬首宫；
 *  2. **值符星** = 地盘旬首宫之星；值符**随时干**（落宫 = 地盘中时干所在宫）；
 *  3. 其余八星按宫序阳顺 / 阴逆排布；
 *  4. **天盘干随星走**：某宫天盘干 = 该宫之星在**地盘原宫**的干；
 *  5. **值使门** = 地盘旬首宫之门；值使**随时支**：从旬首宫起数（时辰 − 旬首）位，阳顺阴逆；
 *  6. 八门按「休生伤杜景死惊开」次序，自值使落宫起阳顺 / 阴逆排布（**中宫无门**）。
 *
 * ⚠️ **待核校**（`reviewed = false`）：以下几处是流派细节，本实现取转盘奇门通行做法，
 * 未与权威典籍逐条核对，golden 5 例（Y6-08）也未采集：
 *  - 九星旋转次序按「地盘宫序」而非「蓬任冲辅禽英芮柱」八星序；
 *  - 天禽居中五宫（亦有寄坤二宫之说）；
 *  - 值使落宫若落在中五宫，按寄坤二宫处理。
 * 这些取法全部写在 `notes` 里随结果返回，**不做静默选择**。
 */

/** 地盘固定九星（宫 → 星） */
export const STAR_BY_PALACE: Record<Palace, string> = {
  1: '天蓬',
  2: '天芮',
  3: '天冲',
  4: '天辅',
  5: '天禽',
  6: '天心',
  7: '天柱',
  8: '天任',
  9: '天英'
}

/** 九星旋转次序（同地盘宫序） */
export const STAR_ORDER = PALACES.map((p) => STAR_BY_PALACE[p])

/** 地盘固定八门（宫 → 门；**中五宫无门**，寄坤二宫） */
export const DOOR_BY_PALACE: Record<Palace, string | null> = {
  1: '休',
  2: '死',
  3: '伤',
  4: '杜',
  5: null,
  6: '开',
  7: '惊',
  8: '生',
  9: '景'
}

/** 八门旋转次序 */
export const DOOR_ORDER = ['休', '生', '伤', '杜', '景', '死', '惊', '开']

/** 六甲旬首 → 遁的六仪 */
export const XUN_SHOU_YI = ['戊', '己', '庚', '辛', '壬', '癸'] as const

export interface QimenPan {
  /** 旬首（六甲）与其遁的六仪、所在宫 */
  xunShou: { ganZhi: string; yi: string; palace: Palace }
  /** 值符星与落宫（随时干） */
  zhiFu: { star: string; palace: Palace }
  /** 值使门与落宫（随时支） */
  zhiShi: { door: string; palace: Palace }
  /** 天盘九星（宫 → 星） */
  stars: Record<Palace, string>
  /** 天盘干（宫 → 干，随星走） */
  heavenlyGan: Record<Palace, string>
  /** 八门（宫 → 门；中宫 null） */
  doors: Record<Palace, string | null>
  /** 八神（宫 → 神；中宫 null，随值符寄坤二宫） */
  gods: Record<Palace, string | null>
  /** 空亡地支（时旬空亡，两个） */
  kongWang: [DiZhi, DiZhi]
  /** 空亡所在宫（由空亡地支映射洛书宫） */
  kongWangPalaces: Palace[]
  /** 驿马地支 */
  maXing: DiZhi
  /** 驿马所在宫 */
  maXingPalace: Palace
  /** 本次排盘采用的流派取法说明（让取法可见） */
  notes: string[]
}

function wrap(n: number): Palace {
  return ((((n - 1) % 9) + 9) % 9 + 1) as Palace
}

/** 时柱干支 → 旬首在六十甲子中的序号（0 / 10 / 20 / 30 / 40 / 50） */
export function xunShouIndex(time: GanZhi): number {
  return Math.floor(time.index / 10) * 10
}

/** 旬首序号 → 遁的六仪 */
export function xunShouYi(xunIndex: number): string {
  return XUN_SHOU_YI[Math.floor(xunIndex / 10) % 6]
}

export function pan(dun: Dun, ju: number, time: GanZhi): QimenPan | undefined {
  const plate: EarthlyPlate | undefined = earthlyPlate(dun, ju)
  if (!plate) return undefined

  const notes: string[] = []

  // ① 旬首
  const xIndex = xunShouIndex(time)
  const yi = xunShouYi(xIndex)
  const xunPalace = plate.byGan[yi]
  const xunText = JIA_ZI_LABEL[xIndex]

  // ② 值符星落宫 = 地盘中「时干」所在宫。
  //    时干为甲时甲不入地盘（遁于六仪），按该旬的六仪取值。
  const effGan = time.gan === '甲' ? yi : time.gan
  if (time.gan === '甲') notes.push('时干为甲，甲遁于六仪，值符按旬首六仪取值')
  const zhiFuPalace = plate.byGan[effGan] ?? xunPalace

  // ③ 天盘九星：自值符落宫起，阳顺阴逆
  const zhiFuStar = STAR_BY_PALACE[xunPalace]
  const i0 = STAR_ORDER.indexOf(zhiFuStar)
  const stars = {} as Record<Palace, string>
  for (let k = 0; k < 9; k++) {
    const palace = dun === 'yang' ? wrap(zhiFuPalace + k) : wrap(zhiFuPalace - k)
    stars[palace] = STAR_ORDER[(i0 + k) % 9]
  }

  // ④ 天盘干随星走：宫中星 → 该星的地盘原宫 → 原宫的地盘干
  const heavenlyGan = {} as Record<Palace, string>
  for (const p of PALACES) {
    const origin = (STAR_ORDER.indexOf(stars[p]) + 1) as Palace
    heavenlyGan[p] = plate.cells[origin]
  }

  // ⑤ 值使门：地盘旬首宫之门（中宫寄坤二）
  const rawDoor = DOOR_BY_PALACE[xunPalace]
  if (!rawDoor) notes.push('旬首宫落在中五宫，八门寄坤二宫')
  const zhiShiDoor = rawDoor ?? DOOR_BY_PALACE[2]!
  const n = time.index - xIndex // 0~9
  let zhiShiPalace = dun === 'yang' ? wrap(xunPalace + n) : wrap(xunPalace - n)
  if (zhiShiPalace === 5) {
    notes.push('值使落宫算得中五宫，按寄坤二宫处理')
    zhiShiPalace = 2
  }

  // ⑥ 八门排布：跳过中五宫，阳顺阴逆
  const seqRaw = PALACES.filter((p) => p !== 5)
  const seq: Palace[] = dun === 'yang' ? seqRaw : [...seqRaw].reverse()
  const start = Math.max(0, seq.indexOf(zhiShiPalace))
  const di = Math.max(0, DOOR_ORDER.indexOf(zhiShiDoor))
  const doors = {} as Record<Palace, string | null>
  for (const p of PALACES) doors[p] = null
  for (let k = 0; k < 8; k++) doors[seq[(start + k) % 8]] = DOOR_ORDER[(di + k) % 8]

  notes.push('九星按地盘宫序旋转，天禽寄居中五宫（未核校）')

  // ⑦ 八神：值符落「值符星」宫，余神阳顺 / 阴逆排于除中五外的八宫
  const gods = {} as Record<Palace, string | null>
  for (const p of PALACES) gods[p] = null
  const seq8 = PALACES.filter((p) => p !== 5)
  const order: Palace[] = dun === 'yang' ? seq8 : [...seq8].reverse()
  let godStart = order.indexOf(zhiFuPalace)
  if (godStart < 0) {
    notes.push('值符落中五宫，八神随值符寄坤二宫')
    godStart = order.indexOf(2)
  }
  for (let k = 0; k < 8; k++) gods[order[(godStart + k) % 8]] = BA_SHEN[k]

  // ⑧ 空亡：时旬空亡（六甲空亡）；地支 → 洛书宫
  const kw = kongWang(time)
  const kwPalaces = Array.from(new Set(kw.map((z) => ZHI_PALACE[z])))

  // ⑨ 驿马：时支三合局取马星
  const mx = MA_XING_RULE[time.zhi]

  notes.push('八神随值符排布、空亡取时旬、驿马按时支三合取（取法待核校）')

  return {
    xunShou: { ganZhi: xunText, yi, palace: xunPalace },
    zhiFu: { star: zhiFuStar, palace: zhiFuPalace },
    zhiShi: { door: zhiShiDoor, palace: zhiShiPalace },
    stars,
    heavenlyGan,
    doors,
    gods,
    kongWang: kw,
    kongWangPalaces: kwPalaces,
    maXing: mx,
    maXingPalace: ZHI_PALACE[mx],
    notes
  }
}

/** 六甲旬首名（便于展示与测试） */
const JIA_ZI_LABEL: Record<number, string> = {
  0: '甲子',
  10: '甲戌',
  20: '甲申',
  30: '甲午',
  40: '甲辰',
  50: '甲寅'
}

/** 供 UI 展示：宫 →「星 / 门 / 天盘干」 */
export function panLines(p: QimenPan, plate: EarthlyPlate): string[] {
  return PALACES.map((n) => {
    const door = p.doors[n] ? `　${p.doors[n]}门` : ''
    return `${n}宫：${p.stars[n]}　${p.heavenlyGan[n]}${door}（地盘${plate.cells[n]}）`
  })
}
