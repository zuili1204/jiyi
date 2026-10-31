<script setup lang="ts">
/**
 * F2 河图洛书（JY-14 §3.5）结构示意。
 * 洛书九宫布数 + 五行方位示意。仅文化示意，不断语。
 */
defineProps<{ title?: string }>()

// 洛书九宫布数（易学通行排布，作结构示意）
const luo = [
  { n: 4, x: 25, y: 25, w: 30 },
  { n: 9, x: 87, y: 25, w: 30 },
  { n: 2, x: 149, y: 25, w: 30 },
  { n: 3, x: 25, y: 87, w: 30 },
  { n: 5, x: 87, y: 87, w: 30 },
  { n: 7, x: 149, y: 87, w: 30 },
  { n: 8, x: 25, y: 149, w: 30 },
  { n: 1, x: 87, y: 149, w: 30 },
  { n: 6, x: 149, y: 149, w: 30 }
]
</script>

<template>
  <svg viewBox="0 0 200 200" width="100%" height="auto" class="fig" role="img" :aria-label="title">
    <!-- 洛书九宫 -->
    <g v-for="c in luo" :key="c.n" :transform="`translate(${c.x} ${c.y})`">
      <rect x="0" y="0" width="30" height="30" fill="none" stroke="var(--line-soft)" rx="2" />
      <text :x="15" :y="20" text-anchor="middle" class="num">{{ c.n }}</text>
    </g>
    <!-- 宫名 -->
    <g :transform="`translate(87 4)`"><text y="8" class="tag">洛书九宫</text></g>
  </svg>
</template>

<style scoped>
.fig {
  display: block;
  max-width: 100%;
}
.num {
  font-size: 13px;
  fill: var(--cinnabar-bright);
  font-family: var(--font-serif);
}
.tag {
  font-size: 9px;
  fill: var(--bronze-bright);
}
</style>