<script setup lang="ts">
/**
 * F7 紫微十二宫环（JY-14 §3.5）结构示意。
 * 外环十二宫扇 + 命宫/身宫定位，主曜名称占位。仅结构示意，不断语。
 */
defineProps<{ title?: string }>()

const palaces = [
  '命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄',
  '迁移', '交友', '官禄', '田宅', '福德', '父母'
]
// 每宫扇区（角度跨度 30°）
const pts = palaces.map((name, i) => {
  const a0 = ((i * 30) - 90) * Math.PI / 180
  const a1 = (((i + 1) * 30) - 90) * Math.PI / 180
  const mid = (a0 + a1) / 2
  return { name, x: 100 + 70 * Math.cos(mid), y: 100 + 70 * Math.sin(mid) }
})
</script>

<template>
  <svg viewBox="0 0 200 200" width="100%" height="auto" class="fig" role="img" :aria-label="title">
    <circle cx="100" cy="100" r="86" fill="none" stroke="var(--line-soft)" />
    <g>
      <line
        v-for="i in 12" :key="i"
        :x1="100" :y1="100" :x2="100 + 86 * Math.cos((i * 30 - 90) * Math.PI / 180)"
        :y2="100 + 86 * Math.sin((i * 30 - 90) * Math.PI / 180)"
        stroke="var(--line-soft)"
      />
    </g>
    <text v-for="p in pts" :key="p.name" :x="p.x" :y="p.y + 4" text-anchor="middle" class="palace">{{ p.name }}</text>
    <text :x="100" :y="103" text-anchor="middle" class="center">身宫位于命宫对宫旁</text>
  </svg>
</template>

<style scoped>
.fig {
  display: block;
  max-width: 100%;
}
.palace {
  font-size: 10px;
  fill: var(--text-2);
  font-family: var(--font-serif);
}
.center {
  font-size: 8px;
  fill: var(--bronze-bright);
}
</style>