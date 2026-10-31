<script setup lang="ts">
/**
 * F3 天干地支五行盘（JY-14 §3.5）结构示意。
 * 外环十二地支 + 天干，标注四时/方位（东方春木、南方夏火、西方秋金、北方冬水）。
 * 仅文化示意，不断语。
 */
defineProps<{ title?: string }>()

const zhi = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
// 方位 + 五行示意（通行对应）
const zones = [
  { name: '东方 · 春 · 木', x: 100, y: 30, color: 'var(--wx-wood)' },
  { name: '南方 · 夏 · 火', x: 170, y: 100, color: 'var(--wx-fire)' },
  { name: '西方 · 秋 · 金', x: 30, y: 100, color: 'var(--wx-metal)' },
  { name: '北方 · 冬 · 水', x: 100, y: 170, color: 'var(--wx-water)' }
]
</script>

<template>
  <svg viewBox="0 0 200 200" width="100%" height="auto" class="fig" role="img" :aria-label="title">
    <circle cx="100" cy="100" r="85" fill="none" stroke="var(--line-soft)" />
    <circle cx="100" cy="100" r="60" fill="none" stroke="var(--line-soft)" />
    <!-- 四正方位线 -->
    <g stroke="var(--bronze)" stroke-width="1" opacity="0.5">
      <line x1="100" y1="15" x2="100" y2="185" />
      <line x1="15" y1="100" x2="185" y2="100" />
    </g>
    <!-- 十二地支（外环 r=78） -->
    <text v-for="(zz, i) in zhi" :key="zz"
      :x="100 + 76 * Math.cos((i * 30 - 90) * Math.PI / 180)"
      :y="100 + 76 * Math.sin((i * 30 - 90) * Math.PI / 180) + 4"
      text-anchor="middle" class="zhi">{{ zz }}</text>
    <!-- 四正区标签 -->
    <text v-for="zone in zones" :key="zone.name" :x="zone.x" :y="zone.y" text-anchor="middle" class="zone" :style="{ color: zone.color }">{{ zone.name }}</text>
  </svg>
</template>

<style scoped>
.fig {
  display: block;
  max-width: 100%;
}
.zhi {
  font-size: 11px;
  fill: var(--text-2);
  font-family: var(--font-serif);
}
.zone {
  font-size: 9px;
}
</style>