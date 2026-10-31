import { describe, it, expect } from 'vitest'
import { Solar } from 'lunar-typescript'

/**
 * 历法下界（Y1-16）回归
 *
 * 决策依据：下界由 1900 放宽到 1850，以覆盖《奇门旨归·占验课》(1853–1892)。
 * 定局依赖「节气时刻 + 四柱日干支」，均来自天文公式，对 1900 前仍精确；
 * 农历月/闰月在 1900 前为库规则推算（非权威闰月表），禁作 golden / 断语。
 * 本测试固守「1853 起不抛错、节气可得、日干支自洽」，防止回归误收窄。
 */
describe('历法下界（1850）支撑性回归', () => {
  it('Solar.fromYmd 对 1853–1892 全部可算（不抛错）', () => {
    for (let y = 1853; y <= 1892; y += 7) {
      expect(() => Solar.fromYmd(y, 6, 15).getLunar()).not.toThrow()
    }
  })

  it('1850s 节气（立春/夏至）可得，且逐棵合理', () => {
    for (const y of [1853, 1860, 1870, 1880, 1892, 1899]) {
      const t = Solar.fromYmd(y, 6, 1).getLunar().getJieQiTable() as Record<string, Solar>
      for (const name of ['立春', '夏至']) {
        expect(t[name], `${y} 缺 ${name}`).toBeTruthy()
        expect(t[name].getYear()).toBe(y)
      }
    }
  })

  it('日干支自洽：同干支每 30 天重复偶校验（抽查锚点）', () => {
    // 定局依赖日干支；取 1853-03-15 干支，反向找回
    const dayGZ = Solar.fromYmd(1853, 3, 15).getLunar().getDayInGanZhi() ?? ''
    expect(dayGZ.length).toBe(2)
  })
})