import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * taibu 独立源 golden（波2-③判读层依赖）
 *
 * 数据来自 DOCS/taibu-master 的 taibu-core@3.5.0（MIT）运行时按固定时间起卦输出
 * （重跑入口：`node DOCS/taibu-master/packages/core/taibu-sample.mjs`）。
 * 本 spec 只读静态 `DOCS/golden/taibu-liuyao.json`，不依赖 dist 构建，CI 可稳定跑。
 *
 * 守卫三点：
 * 1) 独立源 golden 已就位且明确 `reviewed:false`（未经权威核验）；
 * 2) 判读层所用特殊态（暗动/月破/旬空/日破）在本 golden 里都有真实样本出处；
 * 3) `verdict.ts` 采用的三词（旺相可取/平常可参/衰弱受制）与 taibu 实测样本词一致。
 */
function loadGolden(): { samples: Array<{ fullYaos: Array<Record<string, unknown>>; yongShen: Array<Record<string, unknown>> }> } & Record<string, unknown> {
  return JSON.parse(readFileSync(join(process.cwd(), 'DOCS/golden/taibu-liuyao.json'), 'utf8'))
}

const WANG_SHUAI = ['wang', 'xiang', 'xiu', 'qiu', 'si']
const STRENGTH_THREE = ['旺相可取', '平常可参', '衰弱受制']

describe('六爻判读独立源 golden', () => {
  it('tolerance 元信息：第三独立源 + 未核验标记', () => {
    const g = loadGolden()
    expect(g.schemaVersion).toBe(1)
    expect(g.source).toContain('taibu-core')
    expect(g.reviewed).toBe(false)
    expect((g.samples as unknown[]).length).toBeGreaterThanOrEqual(2)
  })

  it('样本结构完整：每卦 6 爻，旺衰 ∈ 旺相休囚死，势 ∈ 已知集', () => {
    const g = loadGolden()
    for (const s of g.samples) {
      expect(s.fullYaos).toHaveLength(6)
      for (const y of s.fullYaos) {
        expect(WANG_SHUAI).toContain(y.wangShuai as string)
        expect(['static', 'hidden_moving', 'changing', 'day_break']).toContain(y.movementState as string)
      }
    }
  })

  it('判读特殊态有真实出处：暗动 / 月破（世爻破）/ 旬空 / 日破 均出现', () => {
    const g = loadGolden()
    const all = g.samples.flatMap((s) => s.fullYaos)
    expect(all.some((y) => y.specialStatus === 'anDong')).toBe(true) // 暗动
    expect(all.some((y) => y.specialStatus === 'yuePo')).toBe(true) // 月破
    expect(all.some((y) => y.kongWangState === 'kong_static')).toBe(true) // 旬空
    expect(all.some((y) => y.movementLabel === '日破')).toBe(true) // 日破
  })

  it('用神技术词与 verdict.ts 的 strength label 同一来源（三词集一致）', () => {
    const g = loadGolden()
    const observed = new Set(
      g.samples.flatMap((s) => s.yongShen.map((ys) => ys.selectedStrengthLabel as string))
    )
    expect(observed.size).toBeGreaterThanOrEqual(2)
    for (const o of observed) expect(STRENGTH_THREE).toContain(o)
  })
})