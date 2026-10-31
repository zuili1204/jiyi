import { afterEach, describe, it, expect } from 'vitest'
import { createApp } from 'vue'
import BaguaSVG from '@/components/tutorial/figures/BaguaSVG.vue'
import HetuLuoshuSVG from '@/components/tutorial/figures/HetuLuoshuSVG.vue'
import GanzhiZodiacSVG from '@/components/tutorial/figures/GanzhiZodiacSVG.vue'
import WuxingSVG from '@/components/tutorial/figures/WuxingSVG.vue'
import LiujiaoDiagram from '@/components/tutorial/figures/LiujiaoDiagram.vue'
import QimenDomeSVG from '@/components/tutorial/figures/QimenDomeSVG.vue'
import ZiweiPalaceSVG from '@/components/tutorial/figures/ZiweiPalaceSVG.vue'
import TakeMomentTimeline from '@/components/tutorial/figures/TakeMomentTimeline.vue'

/**
 * 教程图示（JY-14 §3.5，T6）
 * F1~F8 均为纯 SVG：有 <svg>、viewBox / aria-label、不写死色值（只用令牌 var(--xxx)）。
 */
const CASES = [
  { name: 'Bagua', Comp: BaguaSVG },
  { name: 'HetuLuoshu', Comp: HetuLuoshuSVG },
  { name: 'GanzhiZodiac', Comp: GanzhiZodiacSVG },
  { name: 'Wuxing', Comp: WuxingSVG },
  { name: 'Liujiao', Comp: LiujiaoDiagram },
  { name: 'QimenDome', Comp: QimenDomeSVG },
  { name: 'ZiweiPalace', Comp: ZiweiPalaceSVG },
  { name: 'TakeMoment', Comp: TakeMomentTimeline }
] as const

const mounted: { app: ReturnType<typeof createApp>; el: HTMLElement }[] = []
afterEach(() => {
  while (mounted.length) {
    const m = mounted.pop()!
    m.app.unmount()
    m.el.remove()
  }
})

function render(Comp: typeof BaguaSVG) {
  const app = createApp(Comp, { title: 'x' })
  const el = document.createElement('div')
  document.body.appendChild(el)
  app.mount(el)
  mounted.push({ app, el })
  return el
}

describe('F1~F8 图示 SVG', () => {
  it('8 张图全部渲染出 <svg>', () => {
    for (const { Comp } of CASES) {
      const el = render(Comp)
      const svg = el.querySelector('svg')
      expect(svg, `${Comp.name} 应渲染 <svg>`).toBeTruthy()
    }
  })

  it('每张 SVG 都带 viewBox 与 aria-label（可访问性）', () => {
    for (const { Comp } of CASES) {
      const el = render(Comp)
      const svg = el.querySelector('svg')!
      expect(svg.getAttribute('viewBox'), `${Comp.name} viewBox`).toBeTruthy()
      expect(svg.getAttribute('aria-label'), `${Comp.name} aria-label`).toBeTruthy()
    }
  })

  it('不写死色值，只引用令牌变量 var(--xxx)', () => {
    for (const { Comp } of CASES) {
      const el = render(Comp)
      const html = el.innerHTML
      // 禁止 #hex 或 rgb( 直接构造（应全部走 CSS 令牌）
      expect(html, `${Comp.name} 写死色值`).not.toMatch(/#[0-9a-fA-F]{3,6}\b/)
      expect(html, `${Comp.name} 写死色值`).not.toMatch(/fill="rgb\(|stroke="rgb\(/)
    }
  })

  it('奇门九宫盘应含九个宫格占位', () => {
    const el = render(QimenDomeSVG)
    expect(el.innerHTML).toContain('巽')
    expect(el.innerHTML).toContain('乾')
    expect(el.innerHTML).toContain('拆补法')
  })

  it('八卦图含八方位名', () => {
    const el = render(BaguaSVG)
    for (const n of ['乾', '坤', '坎', '离']) expect(el.innerHTML).toContain(n)
  })
})