import { describe, it, expect } from 'vitest'
import {
  layoutShareCard,
  drawShareCard,
  buildShareCard,
  buildShareCardAuto,
  drawShareCardB,
  hexagramShareFromInterpretation,
  movingMark,
  SHARE_DISCLAIMER,
  type Ctx2D
} from '@/platform/shareCard'
import type { Interpretation } from '@/engine/types'

/**
 * 分享图版式 A（Y2-07）
 * 关注两点：① 图上要素齐全（签号 / 签文 / 出处 / 免责）；② **绝不带出用户输入**（YR19）。
 */
const interp: Interpretation = {
  title: '第 1 签 · 上签',
  summary: '开天辟地作良缘',
  blocks: [
    { key: 'poem', label: '签诗', text: '开天辟地作良缘\n吉日良时万物全', level: 'l1' },
    { key: 'prose', label: '解曰', text: '凡事皆吉也。'.repeat(40), level: 'l1' }
  ],
  basis: { index: 1 },
  source: '《百事问观音》通行本:公有领域',
  school: '观音灵签 · 《百事问观音》通行本'
}

/** 桩 ctx：记录绘制文本与矩形，不依赖真实 canvas */
function stubCtx(): Ctx2D & { texts: string[]; rects: number } {
  const texts: string[] = []
  const box = { rects: 0 }
  return {
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    texts,
    get rects() {
      return box.rects
    },
    set rects(_v: number) {
      /* 只读计数 */
    },
    fillRect() {
      box.rects += 1
    },
    fillText(t: string) {
      texts.push(t)
    },
    measureText(t: string) {
      return { width: t.length * 20 }
    }
  }
}

describe('分享图版面（纯数据）', () => {
  it('含签号标题、签诗与常驻免责', () => {
    const l = layoutShareCard(interp)
    expect(l.title).toContain('第 1 签')
    expect(l.lines[0]).toBe('开天辟地作良缘')
    expect(l.lines[1]).toBe('吉日良时万物全')
    expect(l.disclaimer).toBe(SHARE_DISCLAIMER)
  })

  it('带上出处与流派（无源内容不上图）', () => {
    const l = layoutShareCard(interp)
    expect(l.source).toContain('百事问观音')
    expect(l.school).toContain('观音灵签')
  })

  it('超长解曰被截断，不溢出卡片', () => {
    const l = layoutShareCard(interp, { maxProse: 20 })
    const proseLine = l.lines[l.lines.length - 1]
    expect(proseLine.length).toBeLessThanOrEqual(21)
    expect(proseLine.endsWith('…')).toBe(true)
  })

  it('行数受 maxLines 约束', () => {
    const l = layoutShareCard(interp, { maxLines: 2 })
    expect(l.lines).toHaveLength(2)
  })

  it('版面不含任何用户输入（分享图泄露 PII 防护）', () => {
    // 结构上 layoutShareCard 只接受 Interpretation，无法传入 input；
    // 此用例锁定"即使 interpretation 里混入了 note 也不会被当作正文"这一行为。
    const withNote = {
      ...interp,
      blocks: [...interp.blocks, { key: 'note', label: '所问', text: '我的秘密问题', level: 'l1' as const }]
    }
    const l = layoutShareCard(withNote)
    const all = [l.title, ...l.lines, l.source ?? '', l.school ?? ''].join('|')
    expect(all).not.toContain('我的秘密问题')
  })
})

describe('分享图绘制', () => {
  it('实际绘制的文本包含签号、签文与免责', () => {
    const ctx = stubCtx()
    drawShareCard(ctx, layoutShareCard(interp), { onText: undefined })
    const all = ctx.texts.join('|')
    expect(all).toContain('第 1 签')
    expect(all).toContain('开天辟地作良缘')
    expect(all).toContain(SHARE_DISCLAIMER)
    expect(ctx.texts.length).toBeGreaterThan(0)
  })

  it('onText 回调可用于审计绘制内容', () => {
    const seen: string[] = []
    const ctx = stubCtx()
    drawShareCard(ctx, layoutShareCard(interp), { onText: (t) => seen.push(t) })
    expect(seen.length).toBe(ctx.texts.length)
  })

  it('无 canvas 环境下 buildShareCard 返回 null 而不抛错', () => {
    // jsdom 未提供 2d context：必须优雅降级，由 UI 提示改用截图
    const url = buildShareCard(interp)
    expect(url === null || typeof url === 'string').toBe(true)
  })
})

/** 卦版（版式 B）用的解读结果：卦象结构放在 basis（排盘依据，随记录落库） */
const hexInterp: Interpretation = {
  title: '第 1 卦 · 乾',
  summary: '本卦 乾，之卦 姤',
  blocks: [
    { key: 'benGua', label: '本卦', text: '上乾下乾', level: 'l3' },
    { key: 'note', label: '所问', text: '我的秘密问题', level: 'l3' }
  ],
  basis: {
    lines: [true, true, true, true, true, true],
    dongYao: [2],
    benGua: { index: 1, name: '乾', upper: '乾', lower: '乾' },
    bianGua: { index: 44, name: '姤' }
  },
  source: 'pending:iching-content',
  school: 'none'
}

describe('分享图版式 B（卦版，Y3-12）', () => {
  it('从 basis 还原卦象结构：卦名 / 卦序 / 上下卦 / 之卦 / 动爻', () => {
    const l = hexagramShareFromInterpretation(hexInterp)!
    expect(l).not.toBeNull()
    expect(l.title).toContain('乾')
    expect(l.title).toContain('上乾下乾')
    expect(l.lines).toHaveLength(6)
    expect(l.dongYao).toEqual([2])
    expect(l.changed).toContain('姤')
    expect(l.disclaimer).toBe(SHARE_DISCLAIMER)
  })

  it('卦象结构缺失时返回 null（不猜，由调用方退回版式 A）', () => {
    expect(hexagramShareFromInterpretation({ ...hexInterp, basis: {} })).toBeNull()
    expect(
      hexagramShareFromInterpretation({ ...hexInterp, basis: { benGua: hexInterp.basis!['benGua'] } })
    ).toBeNull()
  })

  it('版面不含任何用户输入（与版式 A 同一条 PII 纪律）', () => {
    const l = hexagramShareFromInterpretation(hexInterp)!
    const all = [l.title, l.changed ?? '', l.source ?? '', l.school ?? ''].join('|')
    expect(all).not.toContain('我的秘密问题')
  })

  it('动爻标记：老阳 ○、老阴 ×', () => {
    expect(movingMark(true)).toBe('○')
    expect(movingMark(false)).toBe('×')
  })

  it('绘制卦象：阳爻一画、阴爻两画，六爻都画出来', () => {
    const ctx = stubCtx()
    // 全阳：6 个 fillRect（外加背景 2 个）
    drawShareCardB(ctx, hexagramShareFromInterpretation(hexInterp)!)
    expect(ctx.rects).toBeGreaterThanOrEqual(8)
    const mixed = stubCtx()
    const l = hexagramShareFromInterpretation({
      ...hexInterp,
      basis: { ...hexInterp.basis!, lines: [true, false, true, false, true, false] }
    })!
    drawShareCardB(mixed, l)
    // 3 阳（各 1 画）+ 3 阴（各 2 画）= 9 画 + 背景 2
    expect(mixed.rects).toBe(11)
  })

  it('绘制内容含卦名、动爻说明、之卦与免责', () => {
    const ctx = stubCtx()
    drawShareCardB(ctx, hexagramShareFromInterpretation(hexInterp)!)
    const all = ctx.texts.join('|')
    expect(all).toContain('乾')
    expect(all).toContain('动爻：第 2 爻')
    expect(all).toContain('姤')
    expect(all).toContain(SHARE_DISCLAIMER)
    // 动爻标记被画出
    expect(ctx.texts).toContain('○')
  })

  it('静卦：不画动爻标记，并注明无动爻', () => {
    const ctx = stubCtx()
    const l = hexagramShareFromInterpretation({
      ...hexInterp,
      basis: { ...hexInterp.basis!, dongYao: [], bianGua: undefined }
    })!
    drawShareCardB(ctx, l)
    expect(ctx.texts).not.toContain('○')
    expect(ctx.texts.join('|')).toContain('无动爻')
    expect(l.changed).toBeUndefined()
  })

  it('buildShareCardAuto 按卦象是否齐备选版式（卜筮 → B，签占 → A）', () => {
    // jsdom 无 canvas，两条路都返回 null；这里验证的是"选版式"这一步不出错
    expect(buildShareCardAuto(hexInterp)).toBeNull()
    expect(buildShareCardAuto(interp)).toBeNull()
    // 选版依据本身可断言
    expect(hexagramShareFromInterpretation(hexInterp)).not.toBeNull()
    expect(hexagramShareFromInterpretation(interp)).toBeNull()
  })
})
