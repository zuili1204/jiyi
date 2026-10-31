import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { naJia } from '@/engine/iching/naJia'
import { HEXAGRAMS } from '@/engine/iching/constants'
import type { CastResult } from '@/engine/iching/cast'

/**
 * 六爻纳甲 × taibu 第二独立源（全량 64 卦，Y3-06 / J8 拍板後）
 *
 * 数据：DOCS/golden/liu-verified-najia.json——taibu-core@3.5.0 运行时逐卦采集
 * （64 卦全量，复现 taibu-najia-all.mjs）；只读静态文件，CI 不需 dist。
 *
 * 本项目 naJia 已按**京房分宫纳甲**修正（本卦六爻 = 下卦八卦内3爻 + 上卦八卦外3爻），
 * 本 spec 锁：**64 卦 × 6 爻 的全字段相等**（宫/豆支/六亲/世应），
 * 防止排盘修复回退、也锁定『与独立引擎一致』这一事实。
 */
type TV = {
  hexagramName: string
  hexagramGong: string
  fullYaos: Array<{ position: number; zhi: string; wuXing: string; liuQin: string; isShiYao: boolean; isYingYao: boolean }>
}
function verified(): { hexagrams: TV[] } {
  return JSON.parse(readFileSync(join(process.cwd(), 'DOCS/golden/liu-verified-najia.json'), 'utf8'))
}
function castFor(name: string): CastResult {
  const h = HEXAGRAMS.find((x) => x.name === name)!
  return { method: 'coin', lines: [], yao: [], dongYao: [], benGua: h, basis: {} } as unknown as CastResult
}

describe('六爻纳甲 × taibu 第二源（京房分宫法，64 卦全量）', () => {
  const { hexagrams } = verified()
  it('快照完整：64 卦 且 卦名齐全', () => {
    expect(hexagrams).toHaveLength(64)
    const names = hexagrams.map((h) => h.hexagramName)
    expect(new Set(names).size).toBe(64)
  })

  it('宫归属：64 卦与项目引擎一致', () => {
    for (const h of hexagrams) {
      expect(naJia(castFor(h.hexagramName)).gong, h.hexagramName).toBe(h.hexagramGong)
    }
  })

  it('逐爻（地支/六亲/世应）64×6 全部一致', () => {
    for (const h of hexagrams) {
      const proj = naJia(castFor(h.hexagramName))
      for (const y of h.fullYaos) {
        const p = proj.yao[y.position - 1]
        expect(p.zhi, `${h.hexagramName} ${y.position}支`).toBe(y.zhi)
        expect(p.liuQin, `${h.hexagramName} ${y.position}亲`).toBe(y.liuQin)
        expect(p.shi, `${h.hexagramName} ${y.position}世`).toBe(y.isShiYao)
        expect(p.ying, `${h.hexagramName} ${y.position}应`).toBe(y.isYingYao)
      }
    }
  })

  })