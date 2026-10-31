<script setup lang="ts">
/**
 * F6 奇门九宫盘（JY-14 §3.5，高优先级）结构示意。
 * 洛书九宫 3×3：宫位标题 + 九星/八门/八神/值符占位；method=chaibu（拆补法定局）。
 * 仅结构示意，不配真盘、不断语。
 */
defineProps<{ title?: string }>()

// 九宫格（方位语义示意）
const cells = [
  { name: '巽宫', x: 0, y: 0 },
  { name: '离宫', x: 67, y: 0 },
  { name: '坤宫', x: 134, y: 0 },
  { name: '震宫', x: 0, y: 67 },
  { name: '中宫', x: 67, y: 67 },
  { name: '兑宫', x: 134, y: 67 },
  { name: '艮宫', x: 0, y: 134 },
  { name: '坎宫', x: 67, y: 134 },
  { name: '乾宫', x: 134, y: 134 }
]
</script>

<template>
  <svg viewBox="0 0 200 200" width="100%" height="auto" class="fig" role="img" :aria-label="title">
    <g v-for="ctl in cells" :key="ctl.name" :transform="`translate(${ctl.x} ${ctl.y})`">
      <rect x="0" y="0" width="67" height="67" fill="none" stroke="var(--line-soft)" rx="2" />
      <text :x="33" :y="20" text-anchor="middle" class="palace">{{ ctl.name }}</text>
      <text :x="33" :y="40" text-anchor="middle" class="placeholder">九星</text>
      <text :x="33" :y="53" text-anchor="middle" class="placeholder">八门 · 八神</text>
    </g>
    <text :x="100" :y="112" text-anchor="middle" class="dome-method">拆补法定局</text>
  </svg>
</template>

<style scoped>
.fig {
  display: block;
  max-width: 100%;
}
.palace {
  font-size: 11px;
  fill: var(--cinnabar-bright);
  font-family: var(--font-serif);
}
.placeholder {
  font-size: 8px;
  fill: var(--text-3);
}
.dome-method {
  font-size: 9px;
  fill: var(--bronze-bright);
}
</style>