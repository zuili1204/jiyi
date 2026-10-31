<script setup lang="ts">
/**
 * F5 六爻装卦示意（JY-14 §3.5）。六爻自下而上（初爻→上爻），
 * 标注世应/六亲占位。仅结构示意，不构成断语。
 */
defineProps<{ title?: string }>()

const yao = ['上爻', '五爻', '四爻', '三爻', '二爻', '初爻']
</script>

<template>
  <svg viewBox="0 0 200 160" width="100%" height="auto" class="fig" role="img" :aria-label="title">
    <g>
      <template v-for="(label, i) in yao" :key="label">
        <rect :x="30" :y="i * 22" width="140" height="14" fill="var(--panel-2)" stroke="var(--line-soft)" rx="2" />
        <text :x="20" :y="i * 22 + 11" text-anchor="middle" class="side">{{ label }}</text>
        <!-- 阳爻实线 / 阴爻两段（固定交替示意） -->
        <g v-if="i < 3">
          <rect :x="45" :y="i * 22 + 4" width="110" height="6" fill="var(--cinnabar)" rx="1" />
        </g>
        <g v-else>
          <rect :x="45" :y="i * 22 + 4" width="50" height="4" fill="var(--cinnabar)" rx="1" />
          <rect :x="103" :y="i * 22 + 4" width="50" height="4" fill="var(--cinnabar)" rx="1" />
        </g>
      </template>
      <!-- 自上而下箭头 -->
      <line x1="180" y1="20" x2="180" y2="140" stroke="var(--bronze)" marker-end="url(#lj-arrow)" />
      <defs>
        <marker id="lj-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 z" fill="var(--bronze)" />
        </marker>
      </defs>
      <text :x="190" :y="80" text-anchor="middle" class="side">起</text>
    </g>
  </svg>
</template>

<style scoped>
.fig {
  display: block;
  max-width: 100%;
}
.side {
  font-size: 10px;
  fill: var(--text-3);
  font-family: var(--font-serif);
}
</style>