import { describe, it, expect } from 'vitest'
import {
  CITIES,
  GEO_META,
  isGeoReviewed,
  lookupCity,
  resolveLongitude,
  searchCities
} from '@/data/geo'
import { trueSolarByPlace, toTrueSolarTime } from '@/engine/calendar'

/** 经度表（Y0-06）：来源与许可可见 + 未命中不猜默认值（YR2 / YR21） */
describe('经度表', () => {
  it('来源与许可声明齐全（YR21：来源不明不得入库）', () => {
    expect(GEO_META.source).toBeTruthy()
    expect(GEO_META.license).toBeTruthy()
    expect(GEO_META.version).toBeGreaterThan(0)
  })

  it('未复核状态可见（不得宣称权威）', () => {
    expect(typeof isGeoReviewed()).toBe('boolean')
  })

  it('覆盖省级行政中心（34 个）', () => {
    expect(CITIES).toHaveLength(34)
  })

  it('经纬度在合法范围内，且无重复 id', () => {
    const ids = new Set(CITIES.map((c) => c.id))
    expect(ids.size).toBe(CITIES.length)
    for (const c of CITIES) {
      expect(c.lon, `${c.name} 经度越界`).toBeGreaterThan(70)
      expect(c.lon).toBeLessThan(140)
      expect(c.lat, `${c.name} 纬度越界`).toBeGreaterThan(15)
      expect(c.lat).toBeLessThan(55)
    }
  })

  it('按名称查找（容忍「市」后缀）', () => {
    expect(lookupCity('北京')?.lon).toBeCloseTo(116.41, 2)
    expect(lookupCity('北京市')?.lon).toBeCloseTo(116.41, 2)
    expect(lookupCity('广州')?.lon).toBeCloseTo(113.26, 2)
  })

  it('模糊搜索可用于选择器', () => {
    expect(searchCities('州').length).toBeGreaterThan(0)
    expect(searchCities('不存在的城市')).toHaveLength(0)
  })

  it('未命中返回 undefined —— 不返回"看起来合理的默认值"（YR2）', () => {
    expect(resolveLongitude('不存在的城市')).toBeUndefined()
    expect(resolveLongitude(undefined)).toBeUndefined()
    expect(resolveLongitude(Number.NaN)).toBeUndefined()
    expect(resolveLongitude(113.26)).toBe(113.26)
  })

  it('乌鲁木齐与北京的经度差 → 订正差约 2 小时量级（跨时区正确性）', () => {
    const d = (lookupCity('北京')!.lon - lookupCity('乌鲁木齐')!.lon) * 4
    expect(d).toBeGreaterThan(100) // 分钟
  })

  it('真太阳时接上经度表：命中城市可订正，未命中不猜值', () => {
    const d = new Date(2024, 5, 15, 12, 0, 0)
    const gz = trueSolarByPlace(d, '广州')!
    expect(gz).toBeDefined()
    expect(gz.longitudeMinutes).toBeCloseTo((113.26 - 120) * 4, 5)
    expect(gz).toEqual(toTrueSolarTime(d, 113.26))
    expect(trueSolarByPlace(d, '不存在的城市')).toBeUndefined()
  })
})
