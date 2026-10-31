import { afterEach, describe, expect, it } from 'vitest'
import { createApp, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import ReadingResult from '@/components/ReadingResult.vue'
import '@/engine' // 副作用：注册全部引擎
import { bootstrapContent } from '@/data/content/bootstrap'
import { getLotEntry } from '@/data/content/lots'
import { buildLotsRecord } from '@/engine/lots'
import { buildIchingRecord } from '@/engine/iching'
import { buildBaziRecord } from '@/engine/bazi'
import { buildZiweiRecord } from '@/engine/ziwei'
import { buildQimenRecord } from '@/engine/qimen'
import type { Interpretation, RandomSource } from '@/engine/types'

/**
 * 六品类盘面在结果页的渲染（Y3-10 / Y5 / Y6-05）
 *
 * 这些盘面是把 `interpretation.basis` 里的**排盘结构**画成图，之前只有引擎层的单测，
 * 没有任何用例验证"结构真的画出来了"。这里用真实引擎产出（不手搓 fixture，
 * 免得测试与引擎各说各话），只断言盘面渲染与"依据可查"这两条。
 */
bootstrapContent()

const BIRTH = {
  year: 1990,
  month: 6,
  day: 15,
  hour: 10,
  minute: 30,
  place: '北京',
  gender: 'male' as const
}
const AT = { year: 2026, month: 9, day: 20, hour: 10, minute: 30 }

const mounted: { app: ReturnType<typeof createApp>; el: HTMLElement }[] = []
afterEach(() => {
  while (mounted.length) {
    const m = mounted.pop()!
    m.app.unmount()
    m.el.remove()
  }
})

function render(interpretation: Interpretation) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const app = createApp(ReadingResult, { interpretation, shareable: false })
  app.use(pinia)
  const el = document.createElement('div')
  document.body.appendChild(el)
  app.mount(el)
  mounted.push({ app, el })
  return el
}

describe('结果页盘面渲染', () => {
  it('八字：四柱表 + 藏干 + 大运', () => {
    const el = render(buildBaziRecord(BIRTH, 't-bazi').interpretation)
    expect(el.querySelector('.bazi')).toBeTruthy()
    const html = el.innerHTML
    // 四柱表的行标签与藏干列
    expect(html).toContain('天干')
    expect(html).toContain('地支')
    expect(html).toContain('藏干')
    expect(html).toContain('大运')
    expect(html).not.toContain('[object Object]')
  })

  it('紫微：十二宫各占一格，且命宫有标记', () => {
    const el = render(buildZiweiRecord(BIRTH, 't-ziwei').interpretation)
    expect(el.querySelector('.ziwei')).toBeTruthy()
    expect(el.querySelectorAll('.ziwei .cell').length).toBe(12)
    expect(el.querySelector('.ziwei .cell-flag')?.textContent).toContain('命宫')
    expect(el.innerHTML).not.toContain('[object Object]')
  })

  it('六爻：纳甲六亲表渲染', () => {
    const rec = buildIchingRecord({ question: '试占', at: AT }, seed('liuyao'), 't-liuyao', 'liujiao')
    const el = render(rec.interpretation)
    expect(el.querySelector('.liuyao')).toBeTruthy()
    expect(el.innerHTML).toContain('纳甲')
    expect(el.innerHTML).not.toContain('[object Object]')
  })

  it('梅花：体用互变面板渲染', () => {
    const rec = buildIchingRecord(
      { type: 'number', question: '试占', a: 7, b: 13 },
      seed('meihua'),
      't-meihua',
      'meihua'
    )
    const el = render(rec.interpretation)
    expect(el.querySelector('.meihua')).toBeTruthy()
    expect(el.innerHTML).toContain('体用互变')
    expect(el.innerHTML).toContain('互卦')
    expect(el.innerHTML).not.toContain('[object Object]')
  })

  it('奇门：九宫格渲染，值符 / 值使落宫有标记', () => {
    const el = render(buildQimenRecord({ at: AT, question: '试占' }, 't-qimen').interpretation)
    expect(el.querySelector('.qimen-pan')).toBeTruthy()
    expect(el.querySelectorAll('.qimen-pan .cell').length).toBe(9)
    expect(el.querySelector('.flag-zf')).toBeTruthy()
    expect(el.querySelector('.flag-zs')).toBeTruthy()
    // 图例如实写明取法口径，不能把暂定口径说成定论
    expect(el.innerHTML).toContain('转盘奇门口径')
  })

  it('签占：签诗按行排版，且行数与原诗行数一致', () => {
    // 从内容母版里找一个确实带签诗的签号，再用桩 rng 强制抽中它 —— 不手写签诗
    let index = 0
    for (let i = 1; i <= 100; i++) {
      if (getLotEntry(i)?.poem) {
        index = i
        break
      }
    }
    expect(index).toBeGreaterThan(0)

    const forced: RandomSource = { next: () => 0, int: (max) => Math.min(index - 1, max - 1) }
    const rec = buildLotsRecord({ note: '试占', kind: 'guanyin' }, forced, 't-lots')
    const poem = rec.interpretation.blocks.find((b) => b.key === 'poem')
    expect(poem).toBeTruthy()

    const el = render(rec.interpretation)
    const lines = el.querySelectorAll('.poem-line')
    const expected = poem!.text
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
    expect(lines.length).toBe(expected.length)
    expect(lines[0].textContent).toBe(expected[0])
    expect(el.innerHTML).not.toContain('[object Object]')
  })

  it('依据区把已画成图的结构折叠说明，其余键仍照旧可查', async () => {
    const el = render(buildQimenRecord({ at: AT, question: '试占' }, 't-basis').interpretation)
    // 展开"排盘依据"
    const toggle = [...el.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').includes('依据')
    )
    expect(toggle).toBeTruthy()
    ;(toggle as HTMLButtonElement).click()
    await nextTick()
    expect(el.innerHTML).toContain('已在上方以图表呈现')
    // 未画成图的口径项仍在依据区里，没有被顺手藏掉
    expect(el.innerHTML).toContain('定局法')
  })
})

/** 固定种子随机源：起卦结果稳定，断言才不会飘 */
function seed(s: string): RandomSource {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const next = () => {
    h = (h + 0x6d2b79f5) >>> 0
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return { next, int: (max: number) => Math.floor(next() * max) }
}
