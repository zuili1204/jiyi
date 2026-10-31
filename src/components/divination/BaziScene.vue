<script setup lang="ts">
/**
 * 八字场景（排盘落定）：四柱依次立起，干支浮现，底座描线。
 * 八字没有「停」的等待——排盘由出生时刻唯一决定，所以只演落定段。
 */
import { computed } from 'vue'

const props = defineProps<{
  phase: 'loop' | 'settle'
  data?: Record<string, unknown>
}>()

/** 四柱真实干支（pillars.year/month/day/time 各含 gan/zhi） */
const pillars = computed(() => {
  const p = (
    props.data as { pillars?: Record<string, { gan?: unknown; zhi?: unknown }> } | undefined
  )?.pillars
  if (!p) return []
  return (['year', 'month', 'day', 'time'] as const)
    .map((k) => p[k])
    .filter(
      (v): v is { gan: string; zhi: string } =>
        !!v && typeof v.gan === 'string' && typeof v.zhi === 'string'
    )
})
const NAMES = ['年', '月', '日', '时'] as const
</script>

<template>
  <div class="scene bazi" aria-hidden="true">
    <div class="pillars" :class="phase">
      <template v-if="pillars.length === 4">
        <div v-for="(p, i) in pillars" :key="i" class="pillar" :style="{ '--i': i }">
          <span class="gz"><b>{{ p.gan }}</b><b>{{ p.zhi }}</b></span>
          <span class="pn">{{ NAMES[i] }}</span>
        </div>
      </template>
      <template v-else>
        <div v-for="i in 4" :key="i" class="pillar ghost"></div>
      </template>
    </div>
    <i class="base-line" :class="phase"></i>
  </div>
</template>

<style scoped>
.scene {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.pillars {
  display: flex;
  gap: 0.1rem;
}
.pillar {
  width: 0.36rem;
  padding: 0.09rem 0 0.07rem;
  border-radius: 0.06rem;
  border: 1px solid var(--line-soft);
  background: var(--panel-2);
  text-align: center;
}
.gz {
  display: flex;
  flex-direction: column;
  gap: 0.015rem;
  font-family: var(--font-serif);
  font-size: 0.17rem;
  line-height: 1.25;
  color: var(--text);
}
.gz b {
  font-weight: normal;
}
.pn {
  display: block;
  margin-top: 0.045rem;
  font-size: 0.1rem;
  color: var(--text-3);
}
.pillar.ghost {
  height: 0.72rem;
  opacity: 0.4;
}
.base-line {
  width: 1.84rem;
  height: 1px;
  margin-top: 0.1rem;
  background: var(--line);
  transform-origin: center;
}

/* 落定：四柱依次立起 */
.settle .pillar {
  animation: pillar-in 0.4s var(--ease-spring) both;
  animation-delay: calc(var(--i) * 130ms);
}
.settle .base-line {
  animation: base-in 0.35s var(--ease-out) 0.55s both;
}
@keyframes pillar-in {
  from {
    opacity: 0;
    transform: translateY(0.26rem);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes base-in {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
@media (prefers-reduced-motion: reduce) {
  .settle .pillar,
  .settle .base-line {
    animation-duration: 0.01ms !important;
    animation-delay: 0ms !important;
  }
}
</style>
