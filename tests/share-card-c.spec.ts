import { describe, it, expect } from 'vitest'
import {
  qimenShareFromInterpretation,
  drawShareCardC,
  buildShareCardC,
  buildShareCardAuto,
  QIMEN_GRID_ORDER,
  SHARE_DISCLAIMER,
  type Ctx2D
} from '@/platform/shareCard'
import { qimenChaibuEngine } from '@/engine/qimen'
import { bootstrapContent } from '@/data/content/bootstrap'
import type { Interpretation } from '@/engine/types'

/**
 * 分享图版式 C（Y6-07）：奇门九宫盘
 *
 * 硬约束（YR19 / JY-04 §4）：
 * 1. 只从 `Interpretation.basis.qimenPan` 取盘面结构，**绝不接触 input**
 *    （奇门 input 含「问事时刻 / 所问何事」）；
 * 2. 图上常驻免责 + 出处 / 流派；
 * 3. 取不到九宫结构 → 返回 null 且**不补空盘**（算不出就是算不出）。
 */
const AT = { year: 2024, month: 3, day: 20, hour: 10, minute: 30 }
/** 奇门起局确定性，随机源给固定桩（引擎签名要求传入） */
const RNG = { next: () => 0, int: () => 0 }
/** 故意塞进 PII 与敏感文本，验证它们绝不会进分享图 */
const QUESTION = '我叫张三，1990-01-01 生于北京，想问这笔投资'

function qimenInterp(): Interpretation {
  bootstrapContent()
  const r = qimenChaibuEngine.compute({ at: AT, question: QUESTION }, RNG)
  return qimenChaibuEngine.interpret(r)
}

function stubCtx(): Ctx2D & { texts: string[] } {
  const texts: string[] = []
  return {
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    texts,
    fillRect: () => {},
    fillText: (t: string) => {
      texts.push(t)
    },
    measureText: (t: string) => ({ width: t.length * 10 })
  }
}

describe('版式 C：奇门盘（结构还原）', () => {
  it('九宫结构齐备时还原出 9 宫，且按洛书顺序（上 巽4 离9 坤2）', () => {
    const layout = qimenShareFromInterpretation(qimenInterp())
    expect(layout).not.toBeNull()
    expect(layout!.palaces).toHaveLength(9)
    expect(layout!.palaces.map((p) => p.palace)).toEqual([...QIMEN_GRID_ORDER])
  })

  it('每宫带星 / 门 / 神 / 天地盘干，中宫门神可为空', () => {
    const layout = qimenShareFromInterpretation(qimenInterp())!
    for (const p of layout.palaces) {
      expect(p.star).toBeTruthy()
      expect(p.earthlyGan).toBeTruthy()
      expect(p.heavenlyGan).toBeTruthy()
    }
    const mid = layout.palaces.find((p) => p.palace === 5)!
    expect(mid.door === null || typeof mid.door === 'string').toBe(true)
  })

  it('值符 / 值使 / 空亡 / 驿马标记随盘带出（UI 只做高亮，不自行推宫）', () => {
    const layout = qimenShareFromInterpretation(qimenInterp())!
    expect(layout.palaces.filter((p) => p.isZhiFu)).toHaveLength(1)
    expect(layout.palaces.filter((p) => p.isZhiShi)).toHaveLength(1)
    expect(layout.palaces.some((p) => p.isKong)).toBe(true)
    expect(layout.palaces.some((p) => p.isMa)).toBe(true)
  })

  it('非奇门结果 → null（不补空盘、不猜）', () => {
    const other: Interpretation = { title: 'x', summary: 'y', blocks: [], basis: {} }
    expect(qimenShareFromInterpretation(other)).toBeNull()
  })
})

describe('版式 C：绘制与脱敏（YR19）', () => {
  it('图上含九宫宫名 / 星 / 门 / 免责', () => {
    const layout = qimenShareFromInterpretation(qimenInterp())!
    const ctx = stubCtx()
    drawShareCardC(ctx, layout)
    const all = ctx.texts.join('|')
    expect(all).toContain('坎1')
    expect(all).toContain('离9')
    expect(all).toContain('门')
    expect(all).toContain(SHARE_DISCLAIMER)
  })

  it('强制脱敏：不含问事时刻 / 所问何事 / 任何用户输入', () => {
    const layout = qimenShareFromInterpretation(qimenInterp())!
    const ctx = stubCtx()
    drawShareCardC(ctx, layout)
    const all = ctx.texts.join('|')
    expect(all).not.toContain('1990')
    expect(all).not.toContain('张三')
    expect(all).not.toContain('北京')
    expect(all).not.toContain('投资')
    expect(all).not.toContain('2024-03-20')
    expect(all).not.toContain('10:30')
  })

  it('buildShareCardC 在无 canvas 环境返回 null（不抛错，由调用方降级）', () => {
    // jsdom 下 canvas 取不到 2d 上下文 → 必须优雅返回 null
    expect(buildShareCardC(qimenInterp())).toBeNull()
  })

  it('自动选版式：奇门盘齐备走 C', () => {
    // 无 canvas 时统一返回 null，此处只验证不会误走 A/B 抛错
    expect(buildShareCardAuto(qimenInterp())).toBeNull()
  })
})
