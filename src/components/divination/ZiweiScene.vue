<script setup lang="ts">
/**
 * 紫微场景（安星落定）：十二宫逐宫点亮，命宫高亮，主星宫缀星子。
 * 紫微排盘由出生时刻唯一决定，没有「停」的等待，只演落定段。
 */
import { computed } from 'vue'

const props = defineProps<{
  phase: 'loop' | 'settle'
  data?: Record<string, unknown>
}>()

/** 十二宫（引擎结果：自命宫逆排，首项即命宫） */
const palaces = computed(() => {
  const t = (
    props.data as { mingGong?: { twelveGong?: unknown } } | undefined
  )?.mingGong?.twelveGong
  if (!Array.isArray(t)) return []
  return t
    .filter(
      (g): g is { name: string; branch: string } =>
        !!g &&
        typeof (g as { name?: unknown }).name === 'string' &&
        typeof (g as { branch?: unknown }).branch === 'string'
    )
    .slice(0, 12)
})
/** 主星按宫（键=地支）：有星的宫缀一颗星子 */
const stars = computed(() => {
  const m = (props.data as { zhuXing?: { mainStars?: unknown } } | undefined)?.zhuXing?.mainStars
  return m && typeof m === 'object' ? (m as Record<string, unknown>) : {}
})
</script>

<template>
  <div class="scene ziwei" aria-hidden="true">
    <div class="board" :class="phase">
      <div
        v-for="(g, i) in palaces"
        :key="i"
        class="cell"
        :class="{ ming: i === 0, starred: !!stars[g.branch] }"
        :style="{ '--i': i }"
      >
        <span class="gn">{{ g.name }}</span>
        <span class="gb">{{ g.branch }}</span>
        <i v-if="stars[g.branch]" class="star"></i>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scene {
  display: flex;
  justify-content: center;
}
.board {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.04rem;
  width: 2.2rem;
}
.cell {
  position: relative;
  padding: 0.05rem 0.02rem 0.06rem;
  border-radius: 0.05rem;
  border: 1px solid var(--line-soft);
  background: var(--panel-2);
  text-align: center;
  overflow: hidden;
}
.gn {
  display: block;
  font-size: 0.085rem;
  line-height: 1.3;
  color: var(--text-3);
  white-space: nowrap;
}
.gb {
  display: block;
  font-family: var(--font-serif);
  font-size: 0.11rem;
  line-height: 1.3;
  color: var(--text);
}
.cell.ming {
  border-color: var(--bronze-bright);
  background: linear-gradient(180deg, rgba(216, 189, 133, 0.12), var(--panel-2));
}
.cell.ming .gn {
  color: var(--bronze-bright);
}
.star {
  position: absolute;
  top: 0.035rem;
  right: 0.04rem;
  width: 0.045rem;
  height: 0.045rem;
  border-radius: 50%;
  background: var(--bronze-bright);
}

/* 落定：逐宫点亮 */
.settle .cell {
  animation: cell-in 0.24s var(--ease-out) both;
  animation-delay: calc(var(--i) * 42ms);
}
.settle .star {
  animation: star-twinkle 1.3s ease-in-out 0.8s infinite;
}
@keyframes cell-in {
  from {
    opacity: 0;
    transform: translateY(0.06rem);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes star-twinkle {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
@media (prefers-reduced-motion: reduce) {
  .settle .cell {
    animation-duration: 0.01ms !important;
    animation-delay: 0ms !important;
  }
  .settle .star {
    animation: none;
  }
}
</style>
