import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import App from '@/App.vue'
import { router } from '@/router'
import { useRecordsStore } from '@/stores/records'

/**
 * 卜筮三种子玩法 UI（Y3-10）
 *
 * 验收要点：三种子玩法**共用同一套历史与结果页链路**。
 * 这里在 jsdom 真挂载整个 App，验证「选玩法 → 起卦 → 结果 → 落库」跑得通，
 * 覆盖单元测试够不到的组件挂载层。
 */
const mounted: { app: ReturnType<typeof createApp>; el: HTMLElement }[] = []
afterEach(() => {
  // 每个用例挂载的是完整 App（路由 + Pinia），用完必须卸载，
  // 否则多个 App 共用同一 router 单例会互相干扰，症状是「随机某个用例卡住」。
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
  await homeRoute()
  await Promise.resolve()
  await new Promise((r) => setTimeout(r, 0))
  await nextTick()
}

/**
 * 复位到首页路由。
 *
 * 起卦后会自动跳到 `/record/:id`，而 router 是**单例**且按 URL（hashchange）同步：
 * 只 `router.replace('/')` 不够 —— `location.hash` 还停在 `#/record/...`，
 * 下一个用例一挂载就被拉回详情页，症状是「找不到按钮：梅花」。
 * 所以 URL 与路由都要复位。
 */
async function homeRoute() {
  if (location.hash !== '' && location.hash !== '#/') location.hash = '#/'
  // jsdom 的 hashchange 是排队异步派发的：不等它派发完就往下走，
  // 上一个用例留下的旧事件会把路由又拉回 /record/:id。
  await new Promise((r) => setTimeout(r, 50))
  await nextTick()
  if (router.currentRoute.value.path !== '/') await router.replace('/')
  await new Promise((r) => setTimeout(r, 50))
  await nextTick()
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function clickByText(el: HTMLElement, selector: string, text: string) {
  const btn = [...el.querySelectorAll<HTMLButtonElement>(selector)].find((b) =>
    (b.textContent ?? '').includes(text)
  )
  if (!btn) throw new Error(`找不到按钮：${text}`)
  btn.click()
}

function setInput(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

/** 等待直到 html 含某文本；不用固定 sleep —— 慢机器上 900ms 动画 + 1000ms 等待会抖动 */
async function waitFor(el: HTMLElement, text: string, timeout = 5000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    if (el.innerHTML.includes(text)) return
    await sleep(50)
    await nextTick()
  }
  throw new Error(`等待「${text}」超时（${timeout}ms）`)
}

/**
 * 提交并走完摇卦：起卦后进入等待态，问卦人按下「停」那一刻才定理卦（Y2-06）。
 * 若一直不点「停」，永远停在等待态——因此测试必须主动点下它。
 * 等待态的文案各玩法不同（摇卦中 / 观机中…），这里等的是「停」按钮本身。
 */
async function submitAndWait(el: HTMLElement) {
  const form = el.querySelector('form')!
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await nextTick()
  const t0 = Date.now()
  while (!el.querySelector('.stop') && Date.now() - t0 < 5000) {
    await sleep(50)
    await nextTick()
  }
  const stop = el.querySelector<HTMLButtonElement>('.stop')
  expect(stop).not.toBeNull()
  stop!.click()
  await waitFor(el, '结果仅供参考') // 结果卡片出现即代表落卦完成
  await nextTick()
}

// jsdom 里挂载整个 App（路由 + Pinia + 四个组件）较慢，单用例超时放宽到 20s
vi.setConfig({ testTimeout: 20000 })

describe('卜筮 UI 全链路（Y3-10）', () => {
  it('六爻：起卦 → 结果含卦宫与旺衰 → 落库', async () => {
    const { el, store } = mount()
    await ready()

    clickByText(el, '.cat', '六爻')
    await nextTick()
    expect(el.innerHTML).toContain('三枚铜钱')

    await submitAndWait(el)

    // 结构与旺衰都渲染出来（母版未装载 → 只有结构，不编造卦辞）
    expect(el.innerHTML).toContain('卦宫')
    expect(el.innerHTML).toContain('纳甲六亲')
    expect(el.innerHTML).toContain('旺衰依据')
    expect(el.innerHTML).toContain('旺衰量化暂按通行口径')
    // 分享图版式 B 已落地 → 卜筮也有了分享入口（内部验证入口仍没有）
    expect(el.innerHTML).toContain('生成分享图')

    // 排盘依据：对象值必须可读，不能渲染成 [object Object]
    const toggle = el.querySelector<HTMLElement>('.basis-toggle')!
    toggle.click()
    await nextTick()
    expect(el.innerHTML).not.toContain('[object Object]')
    expect(el.innerHTML).toContain('本卦')
    expect(el.innerHTML).toContain('六爻（自下而上）')

    // 卦象可视化：本卦画出来（六爻），动爻有标记
    const fig = el.querySelector('.figures')
    expect(fig).not.toBeNull()
    const ben = fig!.querySelectorAll('.hex')[0]
    expect(ben).toBeDefined()
    expect(ben!.querySelectorAll('.yao')).toHaveLength(6)
    expect(ben!.textContent).toContain('本卦')

    expect(store.records.some((r) => r.method === 'liujiao')).toBe(true)
  })

  it('梅花（数字起卦）：结果含体用与互卦 → 落库', async () => {
    const { el, store } = mount()
    await ready()

    clickByText(el, '.cat', '梅花')
    await nextTick()
    clickByText(el, '.chip', '数字')
    await nextTick()

    // 每次都重新查询：表单会随模型更新重渲染，缓存的 DOM 节点可能已被替换
    const numAt = (i: number) =>
      el.querySelectorAll<HTMLInputElement>("input[type='number']")[i]
    expect(el.querySelectorAll("input[type='number']")).toHaveLength(2)

    setInput(numAt(0), '8')
    await nextTick()
    setInput(numAt(1), '16')
    await nextTick()

    // 自检：值进了输入框、且没有必填校验错误（否则提交会被拦下）
    expect(numAt(0).value).toBe('8')
    expect(numAt(1).value).toBe('16')
    expect(el.innerHTML).not.toContain('请填写')

    await submitAndWait(el)

    expect(el.innerHTML).toContain('体用')
    expect(el.innerHTML).toContain('互卦')
    expect(store.records.some((r) => r.method === 'meihua')).toBe(true)
  })

  it('梅花（字数起卦）：按字数成卦', async () => {
    const { el, store } = mount()
    await ready()

    clickByText(el, '.cat', '梅花')
    await nextTick()
    clickByText(el, '.chip', '字数')
    await nextTick()

    const text = el.querySelector<HTMLInputElement>("input[type='text']")!
    setInput(text, '稽疑问事')
    await nextTick()
    // 自检：值确实进了输入框（否则提交会被必填校验拦下，症状是「没进起卦中」）
    expect(text.value).toBe('稽疑问事')

    await submitAndWait(el)

    expect(el.innerHTML).toContain('体用')
    const rec = store.records.filter((r) => r.method === 'meihua').pop()
    expect(rec?.input['type']).toBe('text')
    expect(rec?.input['text']).toBe('稽疑问事')
  })

  it('切换子玩法会清空上一入口的输入（不串参）', async () => {
    const { el } = mount()
    await ready()

    clickByText(el, '.cat', '梅花')
    await nextTick()
    clickByText(el, '.chip', '数字')
    await nextTick()
    const nums = el.querySelectorAll<HTMLInputElement>("input[type='number']")
    setInput(nums[0], '7')
    await nextTick()

    clickByText(el, '.chip', '字数')
    await nextTick()

    // 已切到字数入口：不再有数字输入
    expect(el.querySelectorAll("input[type='number']")).toHaveLength(0)
  })
})
