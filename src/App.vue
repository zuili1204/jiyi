<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'
import Backdrop from '@/components/Backdrop.vue'
import ToastHost from '@/components/ToastHost.vue'

/**
 * 应用外壳
 *
 * 职责（只做壳，不做业务）：
 * - 氛围背景 + 路由过渡 + 底部导航 + 全局轻提示出口
 * - 全局降级开关落到 document.body：`reduce-motion` / `low-end` / `data-theme`
 *
 * 纪律：动效降级必须是"全局一处"，不散落在各组件里各写一份。
 */
const settings = useSettingsStore()

const mq =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null

const systemReduceMotion = ref(mq ? mq.matches : false)

function onMqChange(e: MediaQueryListEvent) {
  systemReduceMotion.value = e.matches
}

onMounted(() => mq?.addEventListener?.('change', onMqChange))
onBeforeUnmount(() => mq?.removeEventListener?.('change', onMqChange))

watchEffect(() => {
  if (typeof document === 'undefined') return
  const body = document.body
  body.classList.toggle('low-end', settings.lowEnd)
  body.classList.toggle('reduce-motion', settings.reduceMotion || systemReduceMotion.value)
  body.dataset.theme = settings.theme
})

const NAV = [
  {
    to: '/',
    label: '占卜',
    path: 'M12 3l2.2 6.6L21 12l-6.8 2.4L12 21l-2.2-6.6L3 12l6.8-2.4z'
  },
  {
    to: '/history',
    label: '记录',
    path: 'M6 3h9l3 3v15H6zM9 9h6M9 13h6M9 17h4'
  },
  {
    to: '/settings',
    label: '设置',
    path: 'M12 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.5 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 15H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 8.5l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.6V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.3z'
  },
  {
    to: '/tutorial',
    label: '教程',
    path: 'M4 4h8a3 3 0 0 1 3 3v13h-3a2 2 0 0 0-2 2H4zM15 9h4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3M8 9h4M8 13h4M8 17h4'
    }
]
</script>

<template>
  <Backdrop />
  <div class="app-body">
    <RouterView v-slot="{ Component }">
      <transition name="route" mode="out-in">
        <component :is="Component" />
      </transition>
    </RouterView>
  </div>

  <nav class="tabbar">
    <RouterLink v-for="n in NAV" :key="n.to" :to="n.to" class="tab">
      <svg viewBox="0 0 24 24" class="tab-icon" fill="none" stroke="currentColor" stroke-width="1.5">
        <path :d="n.path" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span>{{ n.label }}</span>
    </RouterLink>
  </nav>

  <ToastHost />
</template>

<style scoped>
.app-body {
  position: relative;
  z-index: 1;
  /* 底栏实高 ≈ 0.66rem（0.52 min-height + 0.07×2 padding）+ 1px 分隔线，
     余量给 0.9rem 防止长页面最后一行被底栏盖住 */
  padding-bottom: calc(0.9rem + var(--safe-bottom));
}

.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  display: flex;
  /* 必须与 #app 同宽居中（同一 token）：
     fixed 元素默认相对视口定位，宽屏下若不限宽，三个 tab 会被均分到整个窗口，
     与 420px 内容列错位、中间出现大片空白 —— 桌面兜底时看起来像"散架"。 */
  max-width: var(--app-max);
  margin-inline: auto;
  padding-bottom: var(--safe-bottom);
  background: rgba(18, 16, 26, 0.92);
  border-top: 1px solid var(--line-soft);
  backdrop-filter: blur(8px);
}
.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.02rem;
  padding: 0.07rem 0;
  min-height: 0.52rem;
  font-size: 0.1rem;
  color: var(--text-3);
}
.tab-icon {
  width: 0.2rem;
  height: 0.2rem;
}
.tab.router-link-active {
  color: var(--cinnabar-bright);
}
</style>
