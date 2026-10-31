import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import App from '@/App.vue'
import { router } from '@/router'
import { useRecordsStore } from '@/stores/records'
import { useAiStore } from '@/stores/ai'
import { useToastStore } from '@/stores/toast'
import { buildLotsRecord, setLotsContentProvider } from '@/engine/lots'
import { getGuanyinEntry } from '@/data/content/lots'
import { createRandomSource } from '@/engine/random'
import { __setStorageBackend, memoryBackend, clearAiConfig, clearRecords } from '@/platform/storage'

/**
 * AI UI 冒烟（Y8-06 / Y8-07）
 *
 * - 独立设置页：首次启用必须过知情弹窗；一键清除密钥；
 * - 详情页 AI 区块：未配置时明确引导，不给假入口。
 */
const mounted: { app: ReturnType<typeof createApp>; el: HTMLElement }[] = []
let pinia: Pinia

beforeEach(() => {
  __setStorageBackend(memoryBackend)
  clearAiConfig()
  clearRecords()
})

afterEach(() => {
  while (mounted.length) {
    const m = mounted.pop()!
    m.app.unmount()
    m.el.remove()
  }
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function mount() {
  pinia = createPinia()
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

async function resetRoute() {
  await router.isReady()
  if (location.hash !== '' && location.hash !== '#/') location.hash = '#/'
  await sleep(50)
  await nextTick()
  if (router.currentRoute.value.path !== '/') await router.replace('/')
  await sleep(50)
  await nextTick()
}

function toggle(el: HTMLElement, label: string, on: boolean) {
  const item = [...el.querySelectorAll<HTMLElement>('label.item')].find((l) =>
    (l.textContent ?? '').includes(label)
  )
  if (!item) throw new Error(`找不到开关：${label}`)
  const input = item.querySelector<HTMLInputElement>('input[type=checkbox]')!
  input.checked = on
  input.dispatchEvent(new Event('change'))
}

function clickByText(el: HTMLElement, selector: string, text: string) {
  const btn = [...el.querySelectorAll<HTMLElement>(selector)].find((b) =>
    (b.textContent ?? '').includes(text)
  )
  if (!btn) throw new Error(`找不到按钮：${text}`)
  btn.click()
}

vi.setConfig({ testTimeout: 20000 })

describe('AI 独立设置页', () => {
  it('首次启用必须过知情弹窗；确认后才能进服务商配置', async () => {
    const { el } = mount()
    await resetRoute()
    await router.push('/settings/ai')
    await waitFor(() => el.innerHTML.includes('启用 AI 深度解读'), '设置页渲染')

    // 未知情：打开开关 → 出现知情弹窗，而不是直接启用
    toggle(el, '启用 AI 深度解读', true)
    await nextTick()
    expect(el.innerHTML).toContain('启用前请知情')
    expect(el.innerHTML).toContain('明文')
    expect(el.innerHTML).not.toContain('Base URL') // 未确认前不露出服务商配置

    // 确认 → 启用，服务商 / 密钥 / 隐私区出现
    clickByText(el, 'button', '已知晓，启用')
    await nextTick()
    const ai = useAiStore(pinia)
    expect(ai.config.enabled).toBe(true)
    expect(ai.config.acknowledgedAt).not.toBeNull()
    expect(el.innerHTML).toContain('Base URL')
    expect(el.innerHTML).toContain('模型名')
    expect(el.innerHTML).toContain('一键清除密钥')
    expect(el.innerHTML).toContain('风险明示')
  })

  it('一键清除密钥：整包移除并提示', async () => {
    const { el, toast } = mount()
    await resetRoute()
    const ai = useAiStore(pinia)
    ai.update({ apiKey: 'sk-demo', acknowledgedAt: 1, enabled: true })
    await router.push('/settings/ai')
    await waitFor(() => el.innerHTML.includes('一键清除密钥'), '密钥区渲染')

    clickByText(el, 'button', '一键清除密钥')
    await nextTick()
    expect(toast.message).toContain('已清除')
    expect(ai.config.apiKey).toBe('')
    expect(ai.config.enabled).toBe(false) // 清除后回未配置态
  })
})

describe('详情页 AI 区块', () => {
  it('未配置时明确引导去设置，不发请求', async () => {
    setLotsContentProvider(getGuanyinEntry)
    const { el, toast } = mount()
    await resetRoute()
    const store = useRecordsStore(pinia)
    const rec = buildLotsRecord({ kind: 'guanyin', note: '问出行' }, createRandomSource(), 'ai-rec-1')
    store.add(rec)

    await router.push('/record/ai-rec-1')
    await waitFor(() => el.innerHTML.includes('AI 白话解读'), 'AI 区块渲染')

    // 常驻标注（JY-07 §6）
    expect(el.innerHTML).toContain('由 AI 生成，仅供参考')
    expect(el.innerHTML).toContain('去设置')

    clickByText(el, 'button', '生成白话解读')
    await nextTick()
    expect(toast.message).toContain('请先在设置中启用')

    // 去设置 → 独立 AI 设置页
    clickByText(el, 'button', '去设置')
    await waitFor(() => router.currentRoute.value.name === 'settings-ai', '跳转设置页')
  })
})
