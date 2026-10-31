import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import App from '@/App.vue'
import { router } from '@/router'
import { useRecordsStore } from '@/stores/records'
import { buildLotsRecord, setLotsContentProvider } from '@/engine/lots'
import { getGuanyinEntry } from '@/data/content/lots'
import { createRandomSource } from '@/engine/random'

/**
 * 记录详情页（结果不再堆在首页）
 *
 * 验收要点：
 * - 起卦后**自动进详情页**，首页不再内联长结果（签文解曰可达 1600 字）；
 * - 历史页点记录进的是**同一个详情页**（不是另写一套）；
 * - id 不存在 → 空态 + 返回，不造假记录；
 * - 详情页删除 → 回历史页，记录真的没了。
 */
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
  return { app, el, store: useRecordsStore(pinia) }
}

async function ready() {
  await router.isReady()
  // router 是单例且按 URL（hashchange）同步：URL 与路由都要复位，
  // 否则上一个用例停在的 /record/:id 会把下一个用例一起拉过去。
  // jsdom 的 hashchange 是排队异步派发的，必须等它派发完再继续。
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

/** 轮询等待：路由跳转 + 懒加载组件都是异步的，固定 sleep 在慢机器上会抖 */
async function waitFor(check: () => boolean, what: string, timeout = 5000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    if (check()) return
    await sleep(50)
    await nextTick()
  }
  throw new Error(`等待「${what}」超时（${timeout}ms）`)
}

function seed(store: ReturnType<typeof useRecordsStore>, id = 'seed-1') {
  const rec = buildLotsRecord({ kind: 'guanyin', note: '问出行' }, createRandomSource(), id)
  store.add(rec)
  return rec
}

// jsdom 里挂载整个 App（路由 + Pinia + 懒加载视图）较慢
vi.setConfig({ testTimeout: 20000 })

describe('记录详情页', () => {
  beforeEach(() => {
    setLotsContentProvider(getGuanyinEntry)
  })

  it('起卦后自动进入详情页，首页不再内联长结果', async () => {
    const { el, store } = mount()
    await ready()

    // 首页只负责起卦：没有结果卡片
    expect(el.innerHTML).not.toContain('结果仅供参考')

    const form = el.querySelector('form')!
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await nextTick()
    expect(el.innerHTML).toContain('摇签中')

    // 站起来不问：摇签进入等待态后，由问卦人主动按下「停」定签，再进详情页
    const stop = el.querySelector<HTMLButtonElement>('.stop')
    expect(stop).not.toBeNull()
    stop!.click()

    await waitFor(() => el.innerHTML.includes('结果仅供参考'), '详情页渲染')
    await nextTick()

    expect(router.currentRoute.value.name).toBe('record')
    expect(router.currentRoute.value.params['id']).toBe(store.records.at(-1)!.id)
    expect(el.innerHTML).toContain('签诗')
    expect(el.innerHTML).toContain('出处')
  })

  it('首页「最近」与历史页点记录进的是同一个详情页', async () => {
    const { el, store } = mount()
    await ready()
    store.clear()
    const rec = seed(store, 'rec-from-history')

    // 历史页
    await router.push('/history')
    await waitFor(() => el.innerHTML.includes('导出备份'), '历史页渲染')
    await nextTick()

    const row = [...el.querySelectorAll<HTMLElement>('.rec')].find((r) =>
      (r.textContent ?? '').includes(rec.interpretation.title)
    )
    expect(row, '历史页应能找到这条记录').toBeDefined()
    row!.click()

    await waitFor(() => el.innerHTML.includes('结果仅供参考'), '详情页渲染')
    await nextTick()

    expect(router.currentRoute.value.name).toBe('record')
    expect(router.currentRoute.value.params['id']).toBe('rec-from-history')
    expect(el.innerHTML).toContain(rec.interpretation.title)
    // 所问随记录保存，详情页可见（所问为用户自己填的，分享图仍不含）
    expect(el.innerHTML).toContain('问出行')
  })

  it('记录不存在 → 空态 + 返回，不造假记录', async () => {
    const { el } = mount()
    await ready()

    await router.push('/record/does-not-exist')
    await waitFor(() => el.innerHTML.includes('记录不存在'), '空态渲染')
    await nextTick()

    expect(el.innerHTML).toContain('记录不存在或已删除')
    expect(el.innerHTML).not.toContain('结果仅供参考')
    expect(el.querySelector('.result')).toBeNull()
  })

  it('详情页删除 → 回历史页，记录真的没了', async () => {
    const { el, store } = mount()
    await ready()
    store.clear()
    seed(store, 'to-be-deleted')
    expect(store.count).toBe(1)

    await router.push('/record/to-be-deleted')
    await waitFor(() => el.innerHTML.includes('结果仅供参考'), '详情页渲染')
    await nextTick()

    const target = [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      (b.textContent ?? '').includes('删除这条记录')
    )
    expect(target, '详情页应有删除按钮').toBeDefined()
    target!.click()

    await waitFor(() => el.innerHTML.includes('导出备份'), '回到历史页')
    await nextTick()

    expect(router.currentRoute.value.name).toBe('history')
    expect(store.count).toBe(0)
  })
})
