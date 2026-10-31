import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import App from '@/App.vue'
import { router } from '@/router'
import { useToastStore } from '@/stores/toast'

/**
 * UI 占位与导航（未上线品类）
 *
 * 纪律：未上线的功能**给入口、不给假功能** —— 点下去要能明确告知，
 * 而不是跳一个空壳页或点了没反应。这里把这条行为固定下来。
 */
// jsdom 里挂载整个 App 较慢，单用例超时放宽
vi.setConfig({ testTimeout: 20000 })

const mounted: { app: ReturnType<typeof createApp>; el: HTMLElement }[] = []
afterEach(() => {
  while (mounted.length) {
    const m = mounted.pop()!
    m.app.unmount()
    m.el.remove()
  }
})

function mount() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const app = createApp(App)
  app.use(pinia)
  app.use(router)
  const el = document.createElement('div')
  document.body.appendChild(el)
  app.mount(el)
  mounted.push({ app, el })
  return { el, toast: useToastStore(pinia) }
}

async function ready() {
  await router.isReady()
  await Promise.resolve()
  await new Promise((r) => setTimeout(r, 0))
  await nextTick()
}

/** 等待选择器出现（路由懒加载 + 过渡，不给固定 sleep，避免慢机器上抖动） */
async function waitForSelector(el: HTMLElement, selector: string, timeout = 5000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    if (el.querySelector(selector)) return
    await new Promise((r) => setTimeout(r, 50))
    await nextTick()
  }
  throw new Error(`等待「${selector}」超时`)
}

/** 等待任意条件成立（路由跳转断言用） */
async function waitFor(check: () => boolean, what: string, timeout = 5000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    if (check()) return
    await new Promise((r) => setTimeout(r, 50))
    await nextTick()
  }
  throw new Error(`等待「${what}」超时`)
}

function clickByText(el: HTMLElement, selector: string, text: string) {
  const btn = [...el.querySelectorAll<HTMLElement>(selector)].find((b) =>
    (b.textContent ?? '').includes(text)
  )
  if (!btn) throw new Error(`找不到：${text}`)
  btn.click()
}

describe('品类入口与开发中的占位', () => {
  it('六个品类入口都可见（含三个未上线品类）', async () => {
    const { el } = mount()
    await ready()

    const cats = [...el.querySelectorAll<HTMLElement>('.cat')]
    expect(cats).toHaveLength(6)
    const names = cats.map((c) => c.textContent ?? '')
    for (const n of ['签占', '六爻', '梅花', '八字', '紫微', '奇门']) {
      expect(names.some((t) => t.includes(n))).toBe(true)
    }
    // 六品类均已上线，不再有「开发中」标记
    expect(cats.filter((c) => (c.textContent ?? '').includes('开发中'))).toHaveLength(0)
  })

  it('紫微已上线：点击正常切换，不弹「开发中」提示', async () => {
    const { el, toast } = mount()
    await ready()

    clickByText(el, '.cat', '紫微')
    await nextTick()

    expect(toast.message).toBe('')
    expect(el.innerHTML).not.toContain('正在开发中')
    // 切到紫微玩法，显示起步说明
    expect(el.innerHTML).toContain('定命宫')
  })

  it('八字已上线：正常切换，且提示出生数据需授权', async () => {
    const { el, toast } = mount()
    await ready()

    clickByText(el, '.cat', '八字')
    await nextTick()

    expect(toast.message).toBe('')
    expect(el.innerHTML).toContain('四柱排盘')
    expect(el.innerHTML).toContain('需你授权')
  })

  it('点击已上线品类：正常切换，不弹提示', async () => {
    const { el, toast } = mount()
    await ready()

    clickByText(el, '.cat', '六爻')
    await nextTick()

    expect(toast.message).toBe('')
    expect(el.innerHTML).toContain('三枚铜钱')
  })

  it('设置页：AI 已落地跳独立设置页，声音仍提示开发中', async () => {
    const { el, toast } = mount()
    await ready()
    await router.push('/settings')
    await waitForSelector(el, '.item.link')

    // AI 深度解读已随 v1.0 上线（J5）：点击进独立设置页，不再弹「正在开发中」
    clickByText(el, '.item.link', 'AI 深度解读')
    await waitFor(() => router.currentRoute.value.name === 'settings-ai', 'AI 设置页路由')
    await waitFor(() => el.innerHTML.includes('启用 AI 深度解读'), 'AI 设置页渲染')
    expect(toast.message).toBe('')

    // 声音仍未落地：回到主设置页再点，保持占位提示
    await router.push('/settings')
    await waitForSelector(el, '.item.link')
    clickByText(el, '.item.link', '声音')
    await nextTick()
    expect(toast.message).toContain('正在开发中')
  })
})
