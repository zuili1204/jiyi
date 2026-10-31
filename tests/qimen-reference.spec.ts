import { describe, it, expect } from 'vitest'
import {
  EARTH_YANG_ORDER,
  EARTH_YIN_ORDER,
  STAR_META,
  DOOR_META,
  DI_ZHI_LUOSHU,
  SAN_QI
} from '@/engine/qimen/reference'
import {
  STAR_BY_PALACE,
  DOOR_BY_PALACE,
  ZHI_PALACE,
  BA_SHEN,
  XUN_SHOU_YI
} from '@/engine/qimen'
import { QI_YI_YANG, QI_YI_YIN } from '@/engine/qimen/earthlyPlate'

/**
 * 奇门口径核正（Y6-09）
 *
 * 用资料锚点（`reference.ts`）逐项核对排盘实现，把「口径对不对」从人的断言降级成
 * **机器可判的等价不变式**：
 *   1. 九星宫位表、八门属宫表、地支→洛书宫映射 与参照完全一致；
 *   2. 地盘阳遁 / 阴遁干序与实现一致；
 *   3. 六仪 = 六甲遁（甲子戊…甲寅癸）、三奇 = 乙丙丁（不重不漏）。
 * 这些只证「口径自洽且可对照」，不宣称「局数正确」—— 那仍要 golden。
 */
describe('奇门口径参照 ↔ 实现对齐', () => {
  it('九星宫位：STAR_BY_PALACE 与参照逐宫一致', () => {
    for (const [star, meta] of Object.entries(STAR_META)) {
      expect(STAR_BY_PALACE[meta.palace]).toBe(star)
    }
    // 九宫全覆盖、无空
    expect(Object.keys(STAR_BY_PALACE)).toHaveLength(9)
  })

  it('八门属宫：DOOR_BY_PALACE 与参照逐宫一致（中五无门）', () => {
    for (const [door, meta] of Object.entries(DOOR_META)) {
      if (meta.palace !== null) expect(DOOR_BY_PALACE[meta.palace]).toBe(door)
    }
    expect(DOOR_BY_PALACE[5]).toBeNull()
  })

  it('十二支 → 洛书宫映射与参照一致', () => {
    for (const [zhi, p] of Object.entries(DI_ZHI_LUOSHU)) {
      expect(ZHI_PALACE[zhi as keyof typeof ZHI_PALACE]).toBe(p)
    }
  })

  it('地盘阳遁 / 阴遁干序与实现一致', () => {
    expect(EARTH_YANG_ORDER).toEqual([...QI_YI_YANG])
    expect(EARTH_YIN_ORDER).toEqual([...QI_YI_YIN])
  })

  it('六仪 = 六甲遁支、三奇 = 乙丙丁（不重不漏）、八神八职位', () => {
    expect([...XUN_SHOU_YI]).toEqual(['戊', '己', '庚', '辛', '壬', '癸'])
    expect(SAN_QI).toEqual(['乙', '丙', '丁'])
    expect(new Set(SAN_QI).size).toBe(3)
    expect(BA_SHEN).toHaveLength(8)
    expect(new Set(BA_SHEN).size).toBe(8)
  })
})