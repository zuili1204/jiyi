import { afterEach, beforeEach, describe, it, expect } from 'vitest'
import { createApp, nextTick } from 'vue'
import { createPinia } from 'pinia'
import TutorialView from '@/views/TutorialView.vue'
import { __setStorageBackend, type StorageBackend } from '@/platform/storage'

/** jsdom 无 IntersectionObserver，教程页 mounted 会用它，须打桩 */
class MockObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}
;(globalThis as any).IntersectionObserver = MockObserver

/** 每个用例独立的"内存 localStorage/sessionStorage"后端 */
function freshBackend(): StorageBackend {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k)
  }
}

/**
 * 教程页运行时（JY-14 §7.2）
 * - 渲染六玩法卡、决策指南、操作、合规
 * - Toc 章节导航渲染 & 锚点 id 存在
 * - 展开收起：MethodCard 默认折叠 / 点击展开
 * - 首启遮罩：默认未看过时弹出，看过（tookTutorial）不再弹出
 */
const mounted: { app: ReturnType<typeof createApp>; el: HTMLElement }[] = []

function mountView() {
  const pinia = createPinia()
  const app = createApp(TutorialView)
  app.use(pinia)
  // 教程页只用 RouterLink 跳到 /privacy（用 RouterView 过渡），Test 里 stub
  app.component('RouterLink', {
    props: { to: { type: [String, Object], default: '' } },
    template: '<a><slot /></a>'
  })
  const el = document.createElement('div')
  document.body.appendChild(el)
  app.mount(el)
  mounted.push({ app, el })
  return el
}

beforeEach(() => {
  // 每次都给新的内存后端，避免跨用例残留 onboarding 状态
  __setStorageBackend(freshBackend())
})
afterEach(() => {
  while (mounted.length) {
    const m = mounted.pop()!
    m.app.unmount()
    m.el.remove()
  }
})

describe('TutorialView 教程页', () => {
  it('渲染六玩法卡（六张）', async () => {
    const el = mountView()
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))
    const cards = el.querySelectorAll('.method')
    expect(cards.length).toBe(6)
  })

  it('渲染决策指南、操作指引、合规须知标题', async () => {
    const el = mountView()
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))
    const html = el.innerHTML
    expect(html).toContain('六功能介绍')
    expect(html).toContain('怎么选')
    expect(html).toContain('操作指引')
    expect(html).toContain('合规须知')
  })

  it('MethodCard 默认折叠（摘要可见、详情隐藏）', async () => {
    const el = mountView()
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))
    const first = el.querySelector<HTMLElement>('.method')
    expect(first).toBeTruthy()
    // 折叠态：展开详情体不可见
    expect(first!.getAttribute('aria-expanded')).toBe('false')
    const detail = first!.querySelector<HTMLElement>('.m-body')
    expect(detail).toBeTruthy()
    expect(detail!.style.display).toBe('none')
  })

  it('点击玩法卡可展开/收起', async () => {
    const el = mountView()
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))
    const first = el.querySelector<HTMLElement>('.method')!
    expect(first.getAttribute('aria-expanded')).toBe('false')
    ;(first as HTMLElement).click()
    await nextTick()
    expect(el.querySelector<HTMLElement>('.method')!.getAttribute('aria-expanded')).toBe('true')
    const detail = el.querySelector<HTMLElement>('.method .m-body')!
    // v-show 展开后 display 不再是 'none'（可能为空串或 block）
    expect(detail.style.display).not.toBe('none')
  })

  it('Toc 章节条常驻渲染（六项）且各区块存在锚点 id', async () => {
    const el = mountView()
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))
    const toc = el.querySelector('.toc')
    expect(toc).toBeTruthy()
    const items = el.querySelectorAll('.toc-item')
    expect(items.length).toBe(6)
    for (const id of ['intro', 'methods', 'guide', 'operations', 'compliance']) {
      expect(document.getElementById(id), `锚点 ${id}`).toBeTruthy()
    }
  })

  it('易学图示卡渲染 8 张且点击可展开讲解', async () => {
    const el = mountView()
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))
    const cells = el.querySelectorAll('.fig-cell')
    expect(cells.length).toBe(8)
    const first = cells[0] as HTMLElement
    expect(first.getAttribute('aria-expanded')).toBe('false')
    expect(first.querySelector<HTMLElement>('.fig-detail')!.style.display).toBe('none')
    first.click()
    await nextTick()
    expect(el.querySelector('.fig-cell')!.getAttribute('aria-expanded')).toBe('true')
    expect(el.querySelector<HTMLElement>('.fig-cell .fig-detail')!.style.display).not.toBe('none')
  })

  it('决策指南点选问事类型后高亮（弱推荐）', async () => {
    const el = mountView()
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))
    const btn = el.querySelector<HTMLElement>('.scenario')
    expect(btn).toBeTruthy()
    btn!.click()
    await nextTick()
    expect(el.querySelector('.scenario.on')).toBeTruthy()
    expect(el.innerHTML).toContain('传统上常用于')
  })

  it('首启遮罩：默认（未看过）出现；跳过（tookTutorial）后不再出现', async () => {
    // 未看过 → 遮罩出现
    const el = mountView()
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))
    expect(el.querySelector('.overlay')).toBeTruthy()

    // 点「跳过」→ 持久化 tookTutorial / 关掉遮罩
    const ensure = [...el.querySelectorAll<HTMLElement>('.ghost')].find((b) =>
      (b.textContent ?? '').includes('跳过')
    )
    expect(ensure).toBeTruthy()
    ensure!.click()
    await nextTick()

    // 重新挂载：已看过 → 不再弹遮罩
    const el2 = mountView()
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))
    expect(el2.querySelector('.overlay')).toBeFalsy()
  })
})