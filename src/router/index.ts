import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

/**
 * 路由（JY-03 §9 / 信息架构）
 * 纯前端 + Capacitor，用 hash 模式避免原生端 history fallback 问题。
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue')
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('@/views/HistoryView.vue')
  },
  {
    // 结果独立成页：首页与历史页共用同一入口（结果很长，不堆在起卦区下方）
    path: '/record/:id',
    name: 'record',
    component: () => import('@/views/RecordDetailView.vue')
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue')
  },
  {
    // AI 深度解读（BYOK，JY-07 / Y8-06）：独立设置页，主设置页只留入口
    path: '/settings/ai',
    name: 'settings-ai',
    component: () => import('@/views/SettingsAiView.vue')
  },
  {
    // 隐私政策（JY-04 §5.2 七条）：上架必需，且在应用内可直接查看
    path: '/privacy',
    name: 'privacy',
    component: () => import('@/views/PrivacyView.vue')
  },
  {
    // 教程/新手引导（JY-14 §3）：底部第 4 tab 常驻，含章节锚点直达 #/tutorial#<id>
    path: '/tutorial',
    name: 'tutorial',
    component: () => import('@/views/TutorialView.vue')
  }
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes
})
