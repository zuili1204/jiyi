import { DI_ZHI, TIAN_GAN, type DiZhi, type TianGan } from '@/engine/calendar'
import type { MingGongResult } from './palace'
import { computeSiHua, type SiHuaResult } from './siHua'

/**
 * 流年（Y5-05，M5 甲流：可选扩展）
 *
 * 口径（iztro / 《紫微斗数全书》通行）：**流年太岁（流年支）所在的宫即流年命宫**，再依命宫
 * 十二次序（命宫→疾厄…）在盘上顺延排布「流年十二宫」（视同本命宫的活盘）；流年四化按
 * **流年天干**再推一次（仍在十四正曜 / 四化星内）。
 *
 * ⚠️ 口径（待核校 Y5-09）：小限安星公式主流派不一、golden 未入库（`golden/ziwei.json` 的
 * `ziwei-010` 为流年、`todo` 未采），故本模块只落**流年**结构、`reviewed:false`，
 * 小限明确**不落地**（不编造公式）；生年按公历年推算（立春口径与八字一致 J14 暂定）。
 */

/** 公历年 → 年干支（1984 = 甲子） */
export function yearGanZhi(year: number): { gan: TianGan; zhi: DiZhi } {
  const idx = ((year - 4) % 60 + 60) % 60
  return { gan: TIAN_GAN[idx % 10], zhi: DI_ZHI[idx % 12] }
}

export interface LiuNianGong {
  /** 宫名（本命十二宫次序） */
  name: string
  /** 流年所在宫位（地支） */
  branch: DiZhi
}

/**
 * ✅ **流年结构已转正（2026-09-23）**：golden `ziwei-010` 已采且通过，
 * 两个非同源来源一致 —— taibu-core@3.5.0 `calculateZiweiHoroscope(2026)` 与 iztro 逐项一致
 * （流年丙午、四化 天同禄/天机权/文昌科/廉贞忌）。
 *
 * ⚠️ 转正**不含小限**（见 `XIAO_XIAN_REVIEWED`）。
 */
export const LIU_NIAN_REVIEWED = true

/**
 * ✅ **已转正（2026-09-24）**：起宫口诀（「寅午戌人辰上起…」）属典籍通行，
 * 且已取得**第二源** —— iztro@2.6.1（联网安装采样）`astro.getHoroscope` 实测：
 * ziwei-011 虚岁 43 落辰、ziwei-012 虚岁 39 落子，与本项目 `computeXiaoXian` 一致。
 * 详见 golden `ziwei-011 / 012`。
 */
export const XIAO_XIAN_REVIEWED = true

export interface LiuNianResult {
  year: number
  gan: TianGan
  zhi: DiZhi
  /** 流年命宫 = 流年太岁地支 */
  mingBranch: DiZhi
  /** 流年十二宫（命宫→父母），自流年命宫支顺延 */
  gong: LiuNianGong[]
  /** 流年四化（流年干） */
  siHua: SiHuaResult
  /** 小限（男顺女逆，iztro getAgeIndex 口诀；公式 party 不一待 golden，reviewed=false） */
  xiaoXian?: {
    /** 小限落宫地支 */
    branch: DiZhi
    /** 小限所在本命十二宫名 */
    gongName: string
    /** 对应虚岁 */
    age: number
    direction: 'forward' | 'backward'
    /** 小限尚未核验（`XIAO_XIAN_REVIEWED`，无第二源） */
    reviewed: boolean
  }
  /** 流年结构（不含小限）已核验（见 `LIU_NIAN_REVIEWED`） */
  reviewed: boolean
}

/** 小限起宫：按生年支三合定（iztro getAgeIndex 口诀）：
 * 「寅午戌人辰上起、申子辰人自戌、巳酉丑人未宫始、亥卯未人起丑宫」 */
export function xiaoXianStart(branch: DiZhi): DiZhi {
  switch (branch) {
    case '寅': case '午': case '戌': return '辰'
    case '申': case '子': case '辰': return '戌'
    case '巳': case '酉': case '丑': return '未'
    case '亥': case '卯': case '未': return '丑'
  }
}

/**
 * 流年虚岁下的小限落宫：男顺女逆，一岁即起（birthYear 为公历年）。
 * 小限公式主流派不一、golden 未采（Y5-09）故 `reviewed:false`，仅作结构呈现。
 */
export function computeXiaoXian(
  ming: MingGongResult,
  yearBranch: DiZhi,
  gender: 'male' | 'female',
  age: number
): { branch: DiZhi; gongName: string } {
  const I = (z: DiZhi): number => DI_ZHI.indexOf(z)
  const start = I(xiaoXianStart(yearBranch))
  const step = (age - 1) % 12
  const idx = gender === 'male' ? (start + step) % 12 : (start - step + 12) % 12
  const branch = DI_ZHI[idx]
  const m = ming.twelveGong.find((g) => g.branch === branch)
  return { branch, gongName: m?.name ?? '?' }
}

export function computeLiuNian(ming: MingGongResult, year: number): LiuNianResult {
  const { gan, zhi } = yearGanZhi(year)
  // 流年太岁支 → 在本命盘命宫次序里的位置，作为流年命宫
  const fromIdx = ming.twelveGong.findIndex((g) => g.branch === zhi)
  const gong = ming.twelveGong.map((g, i) => ({
    name: g.name,
    branch: ming.twelveGong[(fromIdx + i) % 12].branch
  }))
  return {
    year,
    gan,
    zhi,
    mingBranch: zhi,
    gong,
    siHua: computeSiHua(gan),
    xiaoXian: undefined,
    reviewed: LIU_NIAN_REVIEWED
  }
}