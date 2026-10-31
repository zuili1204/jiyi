<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * 展开收起段落（JY-14 §3.4 折叠纪律）
 * - 默认收起，点标题展开；展开态用 sessionStorage 记忆（tutorial.fold.<id>）
 * - 刷新不丢、跨会话重置
 * - 尊重 body.reduce-motion（App 已接全局开关，这里不另写过度动画）
 */
const props = defineProps<{
  id: string
  title: string
}>()
defineSlots<{ default: unknown }>()

const storageKey = `tutorial.fold.${props.id}`

const open = ref(false)

function readMemory(): boolean {
  try {
    return sessionStorage.getItem(storageKey) === '1'
  } catch {
    return false
  }
}

function remember(v: boolean) {
  try {
    if (v) sessionStorage.setItem(storageKey, '1')
    else sessionStorage.removeItem(storageKey)
  } catch {
    /* 无会话存储时静默忽略 */
  }
}

onMounted(() => {
  open.value = readMemory()
})

onBeforeUnmount(() => remember(open.value))

function toggle() {
  open.value = !open.value
  remember(open.value)
}
</script>

<template>
  <div class="accordion" :class="{ open }">
    <button type="button" class="acc-head" :aria-expanded="open" @click="toggle">
      <span class="acc-caret" aria-hidden="true">{{ open ? '▾' : '▸' }}</span>
      <span class="acc-title">{{ title }}</span>
    </button>
    <div v-show="open" class="acc-body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.accordion {
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-s);
  background: var(--panel-2);
}
.acc-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.08rem;
  min-height: 0.44rem;
  padding: 0 0.12rem;
  color: var(--text);
  font-family: var(--font-serif);
  font-size: 0.14rem;
  cursor: pointer;
}
.acc-head:hover,
.acc-head:focus-visible {
  outline: none;
  color: var(--cinnabar-bright);
}
.acc-caret {
  flex: none;
  color: var(--bronze);
  transition: transform var(--dur-fast) var(--ease-out);
}
.open .acc-caret {
  transform: rotate(90deg);
}
.acc-body {
  padding: 0.04rem 0.14rem 0.14rem;
}
</style>