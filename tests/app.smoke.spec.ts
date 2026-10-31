import { createApp, nextTick } from 'vue'
import { createPinia } from 'pinia'
import App from '@/App.vue'
import { router } from '@/router'
import { useRecordsStore } from '@/stores/records'
import { setLotsContentProvider } from '@/engine/lots'
import { getGuanyinEntry } from '@/data/content/lots'

/**
 * 运行时冒烟（JY-05 §4 验收）：在 jsdom 真正挂载整个 App（路由 + Pinia +
 * SchemaForm + HomeView + 引擎 + 内容包），验证单元测试/typecheck 覆盖不到的
 * 组件挂载层在运行时确实能跑通，且签占全链路（求签 → 真实签文渲染）可用。
 */
/**
 * ⚠️ 必须显式给 timeout：用例内嵌最多 5s 的轮询，若用默认 `testTimeout`（5s），
 * 机器一忙（并行跑 CI / 类型检查）必然超时红——这是 flaky，不是功能回归。
 */
it('挂载整个应用且不抛错，渲染出导航与首页', async () => {
  const pinia = createPinia()
  const app = createApp(App)
  app.use(pinia)
  app.use(router)
  const store = useRecordsStore(pinia)

  const el = document.createElement('div')
  document.body.appendChild(el)
  app.mount(el)

  await router.isReady()
  // 给一次微任务让 router-view（懒加载）完成渲染
  await Promise.resolve()
  await new Promise((r) => setTimeout(r, 0))

  // 导航与首页表单均渲染（证明 路由+Pinia+SchemaForm+HomeView 运行时正常）
  expect(el.innerHTML).toContain('占卜')
  expect(el.querySelector('form')).not.toBeNull()
  expect(el.innerHTML).toContain('签占')
  // 底部第 4 tab【教程】（JY-14 §3.1）
  expect(el.innerHTML).toContain('教程')

  // 注入真实母版后，模拟「求签」提交
  setLotsContentProvider(getGuanyinEntry)
  const form = el.querySelector('form')!
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await nextTick()

  // 摇签动效：先进入等待态（JY-05 §4 路径存在）
  expect(el.innerHTML).toContain('摇签中')

  // 问卦人按下「停」那一刻才定签（Y2-06 互动），随后进详情页。
  const stopBtn = el.querySelector<HTMLButtonElement>('.stop')
  expect(stopBtn).not.toBeNull()
  stopBtn!.click()

  // 出签后自动进详情页。
  // 轮询等**详情页独有文案**：首页自己就有「三套签诗，各一百签」，用「签诗」当信号会立刻误命中。
  // 另外路由是 out-in 过渡，新视图要等旧视图离场后才挂载，所以等内容而不是只等路由名。
  const t0 = Date.now()
  while (!el.innerHTML.includes('结果仅供参考') && Date.now() - t0 < 5000) {
    await new Promise((r) => setTimeout(r, 50))
    await nextTick()
  }

  // 真实签文应被渲染：含「签诗」分块与「出处」（证明 引擎+内容包+详情页 全链路可用）
  expect(store.count).toBe(1)
  expect(router.currentRoute.value.name).toBe('record')
  expect(el.innerHTML).toContain('签诗')
  expect(el.innerHTML).toContain('出处')
  expect(el.innerHTML).toContain('结果仅供参考')
}, 15000)
