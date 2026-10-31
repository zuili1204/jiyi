<script setup lang="ts">
/**
 * F1 八卦图（先天方位示意，JY-14 §3.5）
 * 外圈八位 乾/兑/离/震/巽/坎/艮/坤；阳爻=整段实线、阴爻=两短段（视作结构示意）。
 * 仅结构示意，不构成断语；颜色只用令牌。
 */
defineProps<{ title?: string }>()

// 八卦：三层爻，true=阳、false=阴（卦象仅作结构标识）
const trigrams: boolean[][] = [
  [true, true, true], // 乾
  [false, true, true], // 兑
  [true, false, true], // 离
  [true, false, false], // 震
  [false, true, false], // 巽
  [false, false, true], // 坎
  [false, false, false], // 艮
  [true, true, false] // 坤
]
const names = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤']

const dirs = names.map((name, i) => {
  const rad = ((-90 + i * 45) * Math.PI) / 180
  return {
    name,
    rad,
    cx: 100 + 78 * Math.cos(rad),
    cy: 100 + 78 * Math.sin(rad),
    xl: 100 + 34 * Math.cos(rad),
    yl: 100 + 34 * Math.sin(rad)
  }
})
</script>

<template>
  <svg viewBox="0 0 200 200" width="100%" height="auto" class="fig" role="img" :aria-label="title">
    <circle cx="100" cy="100" r="90" fill="none" stroke="var(--line-soft)" />
    <circle cx="100" cy="100" r="62" fill="none" stroke="var(--line-soft)" />
    <g stroke="var(--bronze)" stroke-width="1" opacity="0.5">
      <line x1="100" y1="10" x2="100" y2="190" />
      <line x1="10" y1="100" x2="190" y2="100" />
    </g>
    <!-- 八位名称 -->
    <text v-for="d in dirs" :key="d.name" :x="d.cx" :y="d.cy + 3" text-anchor="middle" class="dir-text">
      {{ d.name }}
    </text>
    <!-- 内圈三爻（示意） -->
    <g v-for="(d, i) in dirs" :key="'t' + i">
      <g :transform="`translate(${d.xl} ${d.yl})`">
        <rect
          v-for="row in [0, 1, 2]"
          :key="row"
          :x="-8"
          :y="-6 + row * 7"
          width="16"
          height="4"
          fill="var(--cinnabar)"
          :opacity="trigrams[i][row] ? 1 : 0.35"
          rx="1"
        />
      </g>
    </g>
  </svg>
</template>

<style scoped>
.fig {
  display: block;
  max-width: 100%;
}
.dir-text {
  font-size: 10px;
  fill: var(--text-2);
  font-family: var(--font-serif);
}
</style>