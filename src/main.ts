import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import '@/engine' // 副作用：注册全部占卜引擎
import { bootstrapContent } from '@/data/content/bootstrap'
import { useToastStore } from '@/stores/toast'
import '@/assets/styles/tokens.css'
import '@/assets/styles/base.css'
import '@/assets/styles/motion.css'

bootstrapContent() // 注入签诗母版等已采集内容

const app = createApp(App)
app.use(createPinia())
app.use(router)

/**
 * 全局兜底网（最后防线）：
 * 各业务路径（起卦 / 排盘 / 存储 / 分享 / AI）已各自兜底并给出可理解的提示，
 * 这里只接住漏网之错误 —— 绝不允许静默白屏：原始错误进控制台，用户看到短提示。
 */
function notifyFallback(text: string) {
  try {
    useToastStore().show(text)
  } catch {
    // toast 尚未就绪（极端早期错误）：只留日志
  }
}
app.config.errorHandler = (err, _instance, info) => {
  console.error('[jiyi] 页面错误：', err, info)
  notifyFallback('页面出了点小问题，请重试')
}
router.onError((err) => {
  console.error('[jiyi] 页面加载失败：', err)
  notifyFallback('页面加载失败，请重试')
})

app.mount('#app')
