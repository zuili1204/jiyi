import { describe, it, expect } from 'vitest'
import { loadGoldenSuite } from './helpers'
import { castByNumbers, castByText, castByTime, type CastResult } from '@/engine/iching/cast'
import { meiHua } from '@/engine/iching/meiHua'

/**
 * 梅花 golden（Y3-08 体用）
 *
 * 纪律：
 * - `todo: true` 显式 pending 并计数，不用 skip 静默跳过；
 * - 期望值来自 taibu-core@3.5（第二独立源）与《梅花易数》先天八卦数口径；
 * - 本卦 / 互卦 / 变卦 / 体用全部按 `type` 分派到对应的排盘入口，不重实现起卦规则。
 */
const suite = loadGoldenSuite('meihua')

function castOf(c: Record<string, unknown>): CastResult {
  switch (c.type) {
    case 'time':
      return castByTime({
        year: c.year as number,
        month: c.month as number,
        day: c.day as number,
        hour: c.hour as number
      })
    case 'number':
      return castByNumbers(c.a as number, c.b as number)
    case 'text': {
      // JY-08 拍板「字占加时辰」：动爻 = (总字数 + 时辰支) % 6，hour 必填
      const hour = c.hour
      if (typeof hour !== 'number') {
        throw new Error('字数起卦缺 hour（JY-08 已改为必填：动爻计入时辰支）')
      }
      return castByText(c.text as string, hour)
    }
    default:
      throw new Error(`未知起卦类型：${String(c.type)}`)
  }
}

describe('梅花 golden（Y3-08）', () => {
  const todoCount = suite.cases.filter((c) => c.todo).length
  const readyCount = suite.cases.length - todoCount

  it('缺口可见：未采集用例数被统计出来（不是被跳过）', () => {
    console.log(`[golden] meihua：已入库 ${readyCount} / 待采集 ${todoCount}`)
    if (todoCount > 0) expect(todoCount).toBeGreaterThan(0)
  })

  for (const c of suite.cases) {
    if (c.todo) {
      it.todo(`[待采集] ${c.id} — ${c.note ?? c.method}`)
      continue
    }

    it(`${c.id} ${c.method} 与权威来源一致（${c.school}）`, () => {
      const cast = castOf(c.input as Record<string, unknown>)
      const r = meiHua(cast)
      const e = c.expect as {
        shangGua?: string
        xiaGua?: string
        dongYao?: number
        ti?: string
        yong?: string
        huGua?: string
        bianGua?: string
      }
      if (e.shangGua !== undefined) expect(r.benGua.upper, `${c.id} 上卦`).toBe(e.shangGua)
      if (e.xiaGua !== undefined) expect(r.benGua.lower, `${c.id} 下卦`).toBe(e.xiaGua)
      if (e.dongYao !== undefined) expect(r.dongYao[0], `${c.id} 动爻`).toBe(e.dongYao)
      if (e.ti !== undefined) expect(r.ti.trigram, `${c.id} 体卦`).toBe(e.ti)
      if (e.yong !== undefined) expect(r.yong.trigram, `${c.id} 用卦`).toBe(e.yong)
      if (e.huGua !== undefined) expect(r.huGua.name, `${c.id} 互卦`).toBe(e.huGua)
      if (e.bianGua !== undefined) expect(r.bianGua?.name, `${c.id} 变卦`).toBe(e.bianGua)
    })
  }
})
