import cities from './cities.json'

/**
 * 经度表（Y0-06 / JY-02 §3.1）
 *
 * 纪律：
 * - 数据**来源与许可必须可见**（YR21）：文件内 `source` / `license` / `reviewed` 三字段缺一不可；
 * - `reviewed: false` 期间**不得宣称数据权威**，结果页依据区应显示"经度表待复核"；
 * - 未命中内置城市时**必须支持手填经纬度**，不能返回"看起来合理的默认值"（让误差可见 YR2）。
 */

export interface CityCoord {
  id: string
  name: string
  /** 东经为正 */
  lon: number
  lat: number
}

export interface GeoMeta {
  version: number
  source: string
  license: string
  reviewed: boolean
  note: string
}

const doc = cities as unknown as GeoMeta & { items: CityCoord[] }

export const GEO_META: GeoMeta = {
  version: doc.version,
  source: doc.source,
  license: doc.license,
  reviewed: doc.reviewed,
  note: doc.note
}

export const CITIES: CityCoord[] = doc.items

/** 经度表是否已通过权威复核（结果页依据区据此提示） */
export function isGeoReviewed(): boolean {
  return GEO_META.reviewed === true
}

/** 按名称精确查找（不含"市"后缀亦可匹配） */
export function lookupCity(name: string): CityCoord | undefined {
  const key = name.trim()
  if (!key) return undefined
  const bare = key.replace(/市$/, '')
  return CITIES.find((c) => c.name === key || c.name === bare)
}

/** 名称模糊搜索（供 UI 选择器） */
export function searchCities(keyword: string, limit = 20): CityCoord[] {
  const k = keyword.trim()
  if (!k) return CITIES.slice(0, limit)
  return CITIES.filter((c) => c.name.includes(k) || c.id.includes(k.toLowerCase())).slice(0, limit)
}

/**
 * 解析出生地 → 经度。
 *
 * 支持两种输入（对应 UI 的"选城市"与"手填经度"两条路径）：
 * 1. 内置城市名（允许省略"市"）；
 * 2. 直接手填的经度数字，如 `116.4` / `116.4°E` / `东经116.4`。
 *
 * 未命中返回 undefined（由调用方引导手填），**不猜默认值**（YR2）。
 * 此前第 2 条路径实际不可用：`resolveLongitude('116.4')` 会走城市查表而返回
 * undefined，用户手填经度等于白填 —— 这里补齐，并做范围校验挡住 1160 这类手误。
 */
export function resolveLongitude(input: string | number | undefined): number | undefined {
  if (typeof input === 'number') {
    return Number.isFinite(input) && inChinaRange(input) ? input : undefined
  }
  if (typeof input !== 'string') return undefined

  const s = input.trim()
  if (!s) return undefined

  // 手填经度：允许前后缀（东经 / E / ° / 度），核心必须是数字
  const m = /^(?:东经|e|E)?\s*([+-]?\d+(?:\.\d+)?)\s*(?:°|度)?\s*(?:e|E)?$/.exec(s)
  if (m) {
    const n = Number(m[1])
    if (Number.isFinite(n) && inChinaRange(n)) return n
    return undefined
  }

  return lookupCity(s)?.lon
}

/** 经度是否落在合理范围（中国 ≈ 73–135°E；放宽到 ±180 会放过 1160 这类手误） */
function inChinaRange(lon: number): boolean {
  return lon >= 70 && lon <= 140
}
