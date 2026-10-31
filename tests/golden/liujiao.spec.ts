import { describe, it, expect } from 'vitest'
import { loadGoldenSuite } from './helpers'
import { naJia, zhiWuXing, liuQin, type NaJiaResult } from '@/engine/iching/naJia'
import { wangShuai } from '@/engine/iching/wangShuai'
import { HEXAGRAMS, TRIGRAM_BY_NAME } from '@/engine/iching/constants'
import type { CastResult } from '@/engine/iching/cast'

/**
 * 六爻 golden（Y3-06 装卦 / Y3-07 旺衰）
 *
 * 纪律：
 * - `todo: true` 显式 pending 并计数，不用 skip 静默跳过；
 * - 期望值来自独立第二源（taibu-core@3.5 运行时 / 传统旺衰规则），不由实现反推；
 * - naJia 用例的 `coins` 属排盘层的起卦输入，本用例锁的是**装卦不变量**
 *   （地支 / 六亲 / 世应），动爻仍由排盘层（cast）决定，故此处按无动爻装配。
 */
const suite = loadGoldenSuite('liujiao')

/** 按卦名构造无动爻的 CastResult（骨架足够 naJia 使用：它只读 benGua / dongYao） */
function castOf(name: string): CastResult {
  const ben = HEXAGRAMS.find((h) => h.name === name)
  if (!ben) throw new Error(`未知卦名：${name}`)
  const lower = TRIGRAM_BY_NAME[ben.lower]
  const upper = TRIGRAM_BY_NAME[ben.upper]
  if (!lower || !upper) throw new Error(`卦 ${name} 的上下卦缺失`)
  const lines = [...lower.lines, ...upper.lines]
  const yao = lines.map((yang) => ({ value: yang ? 7 : 8, yang, moving: false }))
  return { method: 'coin', lines, yao, dongYao: [], benGua: ben, basis: {} } as CastResult
}

/**
 * 单爻旺衰：调用**引擎** wangShuai（保证与结果页同源），
 * 用一个只含目标地支的合成 najia —— 因为引擎入口是整卦逐爻。
 */
function evalYaoWangShuai(branch: string, yueZhi: string, riZhi: string) {
  const base = naJia(castOf('乾'))
  const wx = zhiWuXing(branch)
  const fake = {
    ...base,
    yao: [
      {
        position: 1,
        gan: '甲',
        zhi: branch,
        wuXing: wx,
        liuQin: liuQin(base.gongElement, wx),
        shi: false,
        ying: false,
        moving: false
      }
    ]
  } as unknown as NaJiaResult
  const r = wangShuai(fake, { yueZhi, riZhi })
  return r.yao[0]
}

describe('六爻 golden（Y3-06 / Y3-07）', () => {
  const todoCount = suite.cases.filter((c) => c.todo).length
  const readyCount = suite.cases.length - todoCount

  it('缺口可见：未采集用例数被统计出来（不是被跳过）', () => {
    console.log(`[golden] liujiao：已入库 ${readyCount} / 待采集 ${todoCount}`)
    if (todoCount > 0) expect(todoCount).toBeGreaterThan(0)
  })

  for (const c of suite.cases) {
    if (c.todo) {
      it.todo(`[待采集] ${c.id} — ${c.note ?? c.method}`)
      continue
    }

    it(`${c.id} ${c.method} 与权威来源一致（${c.school}）`, () => {
      if (c.method === 'naJia') {
        const inp = c.input as { coins?: number[]; hexagram: string }
        const r = naJia(castOf(inp.hexagram))
        const e = c.expect as {
          naJia: string
          liuQin: string
          shiYing: string
          dongYao?: number[]
        }
        expect(r.yao.map((y) => y.zhi).join('、'), `${c.id} 地支`).toBe(e.naJia)
        expect(r.yao.map((y) => y.liuQin).join('、'), `${c.id} 六亲`).toBe(e.liuQin)
        expect(`世${r.shiYao} · 应${r.yingYao}`, `${c.id} 世应`).toBe(e.shiYing)
        return
      }

      if (c.method === 'wangShuai') {
        const inp = c.input as { monthZhi: string; dayGanZhi: string; yao: string }
        const branch = inp.yao.slice(0, 1) // 例：「寅木」→ 寅
        const riZhi = inp.dayGanZhi.slice(-1) // 例：「甲子」→ 子
        const y = evalYaoWangShuai(branch, inp.monthZhi, riZhi)
        const e = c.expect as { score: number; level: string }
        expect(y.score, `${c.id} 旺衰分`).toBe(e.score)
        expect(y.level, `${c.id} 旺衰等级`).toBe(e.level)
        return
      }

      throw new Error(
        `用例 ${c.id} 的 method「${c.method}」尚无执行器：先实现 runner 再接用例（不许改用例迁就实现）`
      )
    })
  }
})
