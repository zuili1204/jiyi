<script setup lang="ts">
/**
 * 奇门场景：转盘布九宫。
 * 循环段——天盘（八门刻度环）在九宫地盘上缓缓转动；
 * 落定段——天盘盖下隐去，九宫逐格点亮，中央浮现定局（如「阳遁三局」）。
 */
import { computed } from 'vue'

const props = defineProps<{
  phase: 'loop' | 'settle'
  data?: Record<string, unknown>
}>()

/** 定局（引擎结果 dingJu：dun=yang|yin，ju=1–9） */
const juLabel = computed(() => {
  const d = (props.data as { dingJu?: { dun?: unknown; ju?: unknown } } | undefined)?.dingJu
  if (!d || (d.dun !== 'yang' && d.dun !== 'yin') || typeof d.ju !== 'number') return ''
  const n = ['一', '二', '三', '四', '五', '六', '七', '八', '九'][d.ju - 1]
  return n ? `${d.dun === 'yang' ? '阳遁' : '阴遁'}${n}局` : ''
})
</script>

<template>
  <div class="scene qimen" aria-hidden="true">
    <div class="pan" :class="phase">
      <!-- 地盘：九宫格 -->
      <div class="grid">
        <i v-for="i in 9" :key="i" class="cell" :style="{ '--i': i - 1 }"></i>
        <span v-if="phase === 'settle' && juLabel" class="ju">{{ juLabel }}</span>
      </div>
      <!-- 天盘：八门刻度环 -->
      <div v-if="phase === 'loop'" class="ring">
        <i v-for="i in 8" :key="i" class="tick" :style="{ '--a': `${i * 45}deg` }"></i>
      </div>
      <div v-else class="ring land"></div>
    </div>
  </div>
</template>

<style scoped>
.scene {
  display: flex;
  justify-content: center;
}
.pan {
  position: relative;
  width: 1.5rem;
  height: 1.5rem;
}

/* 地盘九宫 */
.grid {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 0.03rem;
}
.cell {
  border-radius: 0.04rem;
  border: 1px solid var(--line-soft);
  background: var(--panel-2);
}
.ju {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-serif);
  font-size: 0.13rem;
  letter-spacing: 0.06em;
  color: var(--bronze-bright);
  animation: ju-in 0.3s var(--ease-out) 0.72s both;
}

/* 天盘刻度环 */
.ring {
  position: absolute;
  inset: -0.12rem;
  border-radius: 50%;
  border: 1px dashed var(--bronze-dim);
}
.tick {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 0.04rem;
  height: 0.04rem;
  margin: -0.02rem 0 0 -0.02rem;
  border-radius: 50%;
  background: var(--bronze-bright);
  transform: rotate(var(--a)) translateY(-0.79rem);
}
/* 落定段：天盘盖下隐去（基础态=终态） */
.ring.land {
  opacity: 0;
  animation: land 0.45s var(--ease-out) both;
}

/* 循环段：天盘缓转，九宫静候 */
.loop .ring {
  animation: ring-spin 2.6s linear infinite;
}
/* 落定段：九宫逐格点亮 */
.settle .cell {
  animation: cell-in 0.24s var(--ease-out) both;
  animation-delay: calc(0.2s + var(--i) * 55ms);
}

@keyframes ring-spin {
  to { transform: rotate(360deg); }
}
@keyframes land {
  0% { opacity: 0.9; transform: scale(1.06); }
  60% { opacity: 0.45; }
  100% { opacity: 0; transform: scale(0.86); }
}
@keyframes cell-in {
  from {
    opacity: 0;
    transform: translateY(0.05rem);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes ju-in {
  from { opacity: 0; transform: scale(0.85); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .loop .ring,
  .settle .cell,
  .ring.land,
  .ju {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    animation-delay: 0ms !important;
  }
}
</style>
