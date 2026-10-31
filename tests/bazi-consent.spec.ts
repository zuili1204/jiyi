import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import App from '@/App.vue'
import { router } from '@/router'
import { useRecordsStore } from '@/stores/records'
import { useSettingsStore } from '@/stores/settings'
import { DEFAULT_SETTINGS, saveSettings } from '@/platform/storage'

/**
 * 出生数据授权（Y4-04 / J4）
 *
 * 硬验收点：**未同意不落盘任何出生数据**。
 * 排盘可以照算显示，但写入存储这一步必须等授权 —— 这条不能有例外，所以用真挂载的 UI 流程来测，
 * 单测引擎测不到"用户点了什么"。
 */
const mounted: { app: ReturnType<typeof createApp>; el: HTMLElement }[] = []

afterEach(async () => {
  while (mounted.length) {
    const m = mounted.pop()!
    m.app.unmount()
    m.el.remove()
  }
  if (router.currentRoute.value.path !== '/') await router.replace('/')
})

function mount() {
  const pinia = createPinia()
  setActivePinia(pinia)
  saveSettings({ ...DEFAULT_SETTINGS }) // 每个用例都从"未授权"开始
  const app = createApp(App)
  app.use(pinia)
  app.use(router)
  const el = document.createElement('div')
  document.body.appendChild(el)
  app.mount(el)
  mounted.push({ app, el })
  return { app, el, store: useRecordsStore(pinia), settings: useSettingsStore(pinia) }
}

async function ready() {
  await router.isReady()
  if (location.hash !== '' && location.hash !== '#/') location.hash = '#/'
  await new Promise((r) => setTimeout(r, 50))
  await nextTick()
  if (router.currentRoute.value.path !== '/') await router.replace('/')
  await new Promise((r) => setTimeout(r, 50))
  await nextTick()
  await Promise.resolve()
  await new Promise((r) => setTimeout(r, 0))
  await nextTick()
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function waitFor(check: () => boolean, what: string, timeout = 5000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    if (check()) return
    await sleep(50)
    await nextTick()
  }
  throw new Error(`等待「${what}」超时`)
}

function clickByText(el: HTMLElement, selector: string, text: string) {
  const btn = [...el.querySelectorAll<HTMLButtonElement>(selector)].find((b) =>
    (b.textContent ?? '').includes(text)
  )
  if (!btn) throw new Error(`找不到按钮：${text}`)
  btn.click()
}

function fillDatetime(el: HTMLElement, value: string) {
  const input = el.querySelector<HTMLInputElement>("input[type='datetime-local']")!
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

vi.setConfig({ testTimeout: 20000 })

describe('八字：出生数据授权（Y4-04）', () => {
  it('默认未授权 → 提交后只弹授权门，记录数为 0（不落盘）', async () => {
    const { el, store, settings } = mount()
    await ready()

    expect(settings.birthDataConsent).toBe(false)

    clickByText(el, '.cat', '八字')
    await nextTick()
    fillDatetime(el, '1990-06-15T14:30')
    await nextTick()

    el.querySelector('form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })
    )
    await nextTick()
    await waitFor(() => el.innerHTML.includes('保存出生数据'), '授权门出现')

    // 关键：什么都没写进去
    expect(store.count).toBe(0)
    expect(settings.birthDataConsent).toBe(false)
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('选择「暂不」→ 看到结果但依然不落盘', async () => {
    const { el, store } = mount()
    await ready()

    clickByText(el, '.cat', '八字')
    await nextTick()
    fillDatetime(el, '1990-06-15T14:30')
    await nextTick()
    el.querySelector('form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })
    )
    await nextTick()
    await waitFor(() => el.innerHTML.includes('保存出生数据'), '授权门出现')

    clickByText(el, '.consent button', '暂不')
    await nextTick()
    await waitFor(() => el.innerHTML.includes('未保存'), '未保存提示出现')

    // 结果照显示（四柱），但记录仍为 0
    expect(el.innerHTML).toContain('年柱')
    expect(store.count).toBe(0)
  })

  it('选择「同意保存」→ 授权生效、落库并进详情页', async () => {
    const { el, store, settings } = mount()
    await ready()

    clickByText(el, '.cat', '八字')
    await nextTick()
    fillDatetime(el, '1990-06-15T14:30')
    await nextTick()
    el.querySelector('form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })
    )
    await nextTick()
    await waitFor(() => el.innerHTML.includes('保存出生数据'), '授权门出现')

    clickByText(el, '.consent button', '同意保存')
    await nextTick()
    await waitFor(() => store.count === 1, '记录落库')

    expect(settings.birthDataConsent).toBe(true)
    // 等**内容**而不是只等路由名：路由是 out-in 过渡，新视图要等旧视图离场后才挂载
    await waitFor(() => router.currentRoute.value.name === 'record', '进入详情页')
    await waitFor(() => el.innerHTML.includes('年柱'), '详情页渲染出四柱')
    expect(el.innerHTML).toContain('年柱')
  })
})
