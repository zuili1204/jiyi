<script setup lang="ts">
/**
 * F4 五行相生圈（JY-14 §3.5）结构示意。
 * 木→火→土→金→水→木 箭头生成环。仅示意相生顺序，作文化参考。
 */
defineProps<{ title?: string }>()

const names = ['木', '火', '土', '金', '水']
const pos = names.map((name, i) => {
  const rad = ((-90 + i * 72) * Math.PI) / 180
  return { name, x: 100 + 62 * Math.cos(rad), y: 100 + 62 * Math.sin(rad) }
})
// 相生箭头：从第 i 个指向下一个
const arrows = pos.map((p, i) => {
  const q = pos[(i + 1) % pos.length]
  return { x1: p.x, y1: p.y, x2: q.x, y2: q.y }
})
</script>

<template>
  <svg viewBox="0 0 200 200" width="100%" height="auto" class="fig" role="img" :aria-label="title">
    <!-- 箭头圈 -->
    <g stroke="var(--bronze)" stroke-width="1.2" opacity="0.7">
      <line v-for="(a, i) in arrows" :key="i" :x1="a.x1" :y1="a.y1" :x2="a.x2" :y2="a.y2" marker-end="url(#wux-arrow)" />
    </g>
    <defs>
      <marker id="wux-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
        <path d="M0,0 L7,3.5 L0,7 z" fill="var(--bronze)" />
      </marker>
    </defs>
    <!-- 五行圆点 -->
    <g v-for="p in pos" :key="p.name">
      <circle :cx="p.x" :cy="p.y" r="13" fill="var(--panel-2)" stroke="var(--cinnabar-dim)" stroke-width="1" />
      <text :x="p.x" :y="p.y + 4" text-anchor="middle" class="name">{{ p.name }}</text>
    </g>
  </svg>
</template>

<style scoped>
.fig {
  display: block;
  max-width: 100%;
}
.name {
  font-size: 13px;
  fill: var(--cinnabar-bright);
  font-family: var(--font-serif);
}
</style>