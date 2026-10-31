<script setup lang="ts">
/**
 * F8 年月日时「停」起卦时间轴（JY-14 §3.5，JY-03 §9 落点纪律）。
 * 演示"按下决策瞬间"取动的落点语义，非计算。
 */
defineProps<{ title?: string }>()

const axis = ['起心', '想好问', '按下「停」', '定卦/取签']
</script>

<template>
  <svg viewBox="0 0 200 90" width="100%" height="auto" class="fig" role="img" :aria-label="title">
    <!-- 时间轴 -->
    <line x1="15" y1="45" x2="185" y2="45" stroke="var(--line-soft)" stroke-width="2" />
    <g v-for="(n, i) in axis" :key="n">
      <circle
        :cx="25 + i * 50" :cy="45" r="6"
        :fill="i === axis.length - 1 ? 'var(--cinnabar)' : 'var(--panel-2)'"
        :stroke="i === axis.length - 1 ? 'var(--cinnabar-bright)' : 'var(--bronze-dim)'"
        stroke-width="1"
      />
      <text :x="25 + i * 50" :y="28" text-anchor="middle" class="node" :class="{ hit: i === axis.length - 1 }">{{ n }}</text>
    </g>
    <text :x="100" :y="78" text-anchor="middle" class="hint">决定落在下这一刻，取当下随机源</text>
  </svg>
</template>

<style scoped>
.fig {
  display: block;
  max-width: 100%;
}
.node {
  font-size: 10px;
  fill: var(--text-2);
  font-family: var(--font-serif);
}
.node.hit {
  fill: var(--cinnabar-bright);
}
.hint {
  font-size: 9px;
  fill: var(--text-3);
}
</style>