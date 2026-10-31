/**
 * 真太阳时订正（JY-02 §3.1 / P3）
 *
 * 库不提供真太阳时（JY-02 §4.4 缺口），自研实现。
 *
 * 真太阳时 = 本地平时 + 经度订正 + 均时差(EoT)
 *   经度订正(分钟) = (出生地经度 - 时区标准经度) × 4     【中国：标准经度 120°E】
 *   EoT(分钟) ≈ 9.87·sin(2B) − 7.53·cos(B) − 1.5·sin(B)
 *   B = 2π × (年内日序 N − 81) / 364
 *
 * 精度：上式为常用近似式，约 ±1 分钟。
 * ✅ **已由 golden 核验（2026-09-23）**：`calendar-015/016` 与 **NOAA 天文级 EoT**
 * 对拍，Δ ≈ 1.08 分钟，与「±1 分钟」的自评相符（经度订正部分为精确值）。
 *
 * 纪律（YR2）：**让误差可见** —— 必须同时返回订正后的时刻与订正分钟数，
 * 结果页要能显示"已按经度 X 订正 N 分钟（含均时差 ±M 分钟）"。
 */

import { resolveLongitude } from '@/data/geo'

export interface TrueSolarResult {
  /** 订正后的时刻 */
  corrected: Date
  /** 经度订正（分钟，可正可负） */
  longitudeMinutes: number
  /** 均时差（分钟，可正可负） */
  eotMinutes: number
  /** 合计订正（分钟） */
  totalMinutes: number
}

/** 时区标准经度（度）：东八区 = 120 */
export const STANDARD_LONGITUDE_UTC8 = 120

/** 均时差 EoT（分钟），近似式，精度约 ±1 分钟（待验证） */
export function equationOfTime(date: Date): number {
  const start = Date.UTC(date.getFullYear(), 0, 1)
  const dayOfYear = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - start) / 86400000) + 1
  const B = (2 * Math.PI * (dayOfYear - 81)) / 364
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B)
}

/** 经度订正（分钟）：(经度 − 标准经度) × 4 */
export function longitudeCorrection(longitude: number, standardLongitude = STANDARD_LONGITUDE_UTC8): number {
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error(`经度非法：${longitude}`)
  }
  return (longitude - standardLongitude) * 4
}

/**
 * 真太阳时订正。
 * @param date      本地平时（出生时刻）
 * @param longitude 出生地经度（东经为正）
 */
export function toTrueSolarTime(
  date: Date,
  longitude: number,
  standardLongitude = STANDARD_LONGITUDE_UTC8
): TrueSolarResult {
  const longitudeMinutes = longitudeCorrection(longitude, standardLongitude)
  const eotMinutes = equationOfTime(date)
  const totalMinutes = Math.round((longitudeMinutes + eotMinutes) * 10) / 10
  const corrected = new Date(date.getTime() + totalMinutes * 60000)
  return { corrected, longitudeMinutes, eotMinutes, totalMinutes }
}

/**
 * 按**出生地名称**取经度后订正（Y1-07 接 Y0-06 经度表）。
 * 城市未命中内置表时返回 undefined —— 由调用方引导用户手填经纬度，
 * **不猜默认值**（YR2：让误差可见，而不是给出看起来合理的值）。
 */
export function trueSolarByPlace(date: Date, place: string): TrueSolarResult | undefined {
  const lon = resolveLongitude(place)
  return lon === undefined ? undefined : toTrueSolarTime(date, lon)
}

/** 供 UI 显示的一句话说明（YR2：让误差可见） */
export function describeCorrection(r: TrueSolarResult, longitude: number): string {
  const lon = `已按经度 ${longitude.toFixed(2)}°E 订正 ${r.longitudeMinutes.toFixed(1)} 分钟`
  const eot = `（含均时差 ${r.eotMinutes >= 0 ? '+' : ''}${r.eotMinutes.toFixed(1)} 分钟）`
  return `${lon}${eot}，合计 ${r.totalMinutes >= 0 ? '+' : ''}${r.totalMinutes.toFixed(1)} 分钟`
}
