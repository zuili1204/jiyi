<script setup lang="ts">
import { nextTick, ref, watch, onMounted } from 'vue'

/**
 * 章节导航条（JY-14 §3.4）
 * 常驻横向章节条：章节一目了然、当前章节常亮并自动滚到可视区中央，点击直达锚点。
 * 相比旧的折叠抽屉：少一次点开操作，且滚动过程中始终能看到「读到哪了」。
 */
const props = defineProps<{
  sections: { id: string; title: string }[]
  activeId: string
}>()
const emit = defineEmits<{ (e: 'navigate', id: string): void }>()

/** 章节中文序号（超出预置字表时回退为阿拉伯数字） */
const CN_NUMS = ['一', '二', '三', '四', '五', '六', '七', '八', '九']
function num(i: number): string {
  return CN_NUMS[i] ?? String(i + 1)
}

const scroller = ref<HTMLElement | null>(null)

/** 把当前章节滚动条目滚到可视区中央（手动算 scrollLeft，避免 scrollIntoView 牵动整页） */
function centerActive(smooth = true) {
  const c = scroller.value
  const el = c?.querySelector('.toc-item.active')
  if (!c || !el) return
  const target = (el as HTMLElement).offsetLeft - c.clientWidth / 2 + (el as HTMLElement).clientWidth / 2
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  c.scrollTo({ left: Math.max(0, target), behavior: smooth && !reduce ? 'smooth' : 'auto' })
}

watch(
  () => props.activeId,
  () => nextTick(() => centerActive())
)
onMounted(() => nextTick(() => centerActive(false)))

/**
 * 鼠标拖拽横滑（触屏走原生滚动，这里只补桌面端体验）。
 * 关键：纯点击不捕获指针——setPointerCapture 会把 click 重定向到容器，
 * 章节按钮就收不到点击、无法跳转。只有拖动超过阈值才接管指针。
 * 接管后的拖拽若已接近点击（>6px 仍吞 click），避免拖完误触。
 */
const dragging = ref(false)
let captured = false
let startX = 0
let startScroll = 0
let moved = 0

function onPointerDown(e: PointerEvent) {
  if (e.pointerType !== 'mouse' || e.button !== 0) return
  dragging.value = true
  captured = false
  moved = 0
  startX = e.clientX
  startScroll = scroller.value?.scrollLeft ?? 0
}
function onPointerMove(e: PointerEvent) {
  if (!dragging.value) return
  const dx = e.clientX - startX
  if (!captured) {
    if (Math.abs(dx) <= 4) return
    captured = true
    scroller.value?.setPointerCapture(e.pointerId)
  }
  moved = Math.max(moved, Math.abs(dx))
  if (scroller.value) scroller.value.scrollLeft = startScroll - dx
}
function onPointerUp(e: PointerEvent) {
  if (!dragging.value) return
  dragging.value = false
  if (captured) scroller.value?.releasePointerCapture?.(e.pointerId)
}
function onClickCapture(e: MouseEvent) {
  if (moved > 6) {
    e.preventDefault()
    e.stopPropagation()
    moved = 0
  }
}
</script>

<template>
  <nav class="toc" aria-label="本页章节">
    <div
      ref="scroller"
      class="toc-scroll"
      :class="{ dragging }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @click.capture="onClickCapture"
    >
      <button
        v-for="(s, i) in sections"
        :key="s.id"
        type="button"
        class="toc-item"
        :class="{ active: s.id === activeId }"
        :aria-current="s.id === activeId ? 'true' : undefined"
        @click="emit('navigate', s.id)"
      >
        <span class="toc-no" aria-hidden="true">{{ num(i) }}</span>
        <span class="toc-title">{{ s.title }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.toc {
  position: sticky;
  top: 0.06rem;
  z-index: 10;
  margin: 0.06rem auto 0;
  max-width: calc(var(--app-max) - 0.1rem);
  padding: 0 0.05rem;
}
/* 横向滚动视口：两端渐隐提示可滑，滚动条隐藏；桌面端可按住拖拽 */
.toc-scroll {
  position: relative;
  display: flex;
  gap: 0.06rem;
  overflow-x: auto;
  padding: 0.05rem;
  background: color-mix(in srgb, var(--panel) 82%, transparent);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-pill);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
  scrollbar-width: none;
  scroll-snap-type: x proximity;
  user-select: none;
  -webkit-user-select: none;
  cursor: grab;
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 0.12rem, #000 calc(100% - 0.12rem), transparent 100%);
  mask-image: linear-gradient(90deg, transparent 0, #000 0.12rem, #000 calc(100% - 0.12rem), transparent 100%);
}
.toc-scroll.dragging {
  cursor: grabbing;
  scroll-snap-type: none;
}
.toc-scroll::-webkit-scrollbar {
  display: none;
}
.toc-item {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 0.04rem;
  min-height: 0.3rem;
  padding: 0 0.11rem;
  border-radius: var(--radius-pill);
  border: 1px solid transparent;
  font-size: 0.11rem;
  color: var(--text-2);
  white-space: nowrap;
  scroll-snap-align: center;
  transition: color var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out),
    background var(--dur-fast) var(--ease-out);
}
.toc-item:hover {
  color: var(--cinnabar-bright);
}
.toc-item:focus-visible {
  outline: none;
  border-color: var(--bronze-dim);
}
.toc-no {
  font-family: var(--font-serif);
  font-size: 0.1rem;
  color: var(--bronze);
}
.toc-title {
  letter-spacing: 0.02em;
}
.toc-item.active {
  color: var(--cinnabar-bright);
  border-color: var(--cinnabar-dim);
  background: color-mix(in srgb, var(--cinnabar) 12%, transparent);
}
.toc-item.active .toc-no {
  color: var(--cinnabar-bright);
}
</style>
