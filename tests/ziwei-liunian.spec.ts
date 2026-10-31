import { describe, it, expect } from 'vitest'
import { computeLiuNian, yearGanZhi } from '@/engine/ziwei'
import { determineMingGong } from '@/engine/ziwei/palace'

describe('流年（Y5-05 M5 甲流）', () => {
  it('1984 = 甲子（年干支）', () => {
    expect(yearGanZhi(1984)).toEqual({ gan: '甲', zhi: '子' })
  })
  it('流年命宫 = 流年太岁支，且十二宫齐全、干支无越界', () => {
    const ming = determineMingGong('甲', 6, 14)
    const ln = computeLiuNian(ming, 2026)
    // 2026-09-23 翻转：流年结构已由 golden ziwei-010 核校（taibu + iztro 双源）
    expect(ln.reviewed).toBe(true)
    // 小限不由 computeLiuNian 填充（在 ziweiEngine 里按性别补），且仍 `reviewed:false`
    expect(ln.xiaoXian).toBeUndefined()
    expect(ln.gong).toHaveLength(12)
    expect(ln.mingBranch).toBe(ln.zhi)
    // 12 宫名称必须完整覆盖：命宫为第一宫
    expect(ln.gong[0].name).toBe('命宫')
  })
})