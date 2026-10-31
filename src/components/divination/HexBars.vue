<script setup lang="ts">
/**
 * 卦象横线组（六爻 / 梅花共用）：六爻自下而上，阳爻整条、阴爻断开，
 * 动爻右侧缀朱砂点。纯展示，不含业务；入场为逐爻堆叠。
 */
const props = withDefaults(defineProps<{ lines: boolean[]; moving?: number[] }>(), {
  moving: () => []
})
</script>

<template>
  <div class="hex" aria-hidden="true">
    <div
      v-for="i in 6"
      :key="i"
      class="yao"
      :class="{ dong: props.moving.includes(i) }"
      :style="{ '--i': i - 1 }"
    >
      <template v-if="props.lines[i - 1]">
        <i class="bar full"></i>
      </template>
      <template v-else>
        <i class="bar half"></i>
        <i class="bar half"></i>
      </template>
    </div>
  </div>
</template>

<style scoped>
.hex {
  display: flex;
  /* 初爻在下：自下而上成卦 */
  flex-direction: column-reverse;
  gap: 0.05rem;
  width: 1.5rem;
}
.yao {
  position: relative;
  display: flex;
  justify-content: center;
  gap: 0.07rem;
  animation: yao-in 0.26s var(--ease-out) both;
  animation-delay: calc(var(--i) * 85ms);
}
.bar {
  height: 0.055rem;
  border-radius: 0.03rem;
  background: linear-gradient(180deg, var(--bronze-bright), var(--bronze));
}
.full {
  flex: 1;
}
.half {
  flex: 0.42;
}
.yao.dong::after {
  content: '';
  position: absolute;
  right: -0.13rem;
  top: 50%;
  width: 0.055rem;
  height: 0.055rem;
  margin-top: -0.028rem;
  border-radius: 50%;
  background: var(--cinnabar-bright);
  animation: dong-pop 0.3s var(--ease-spring) both;
  animation-delay: calc(var(--i) * 85ms + 0.2s);
}
@keyframes yao-in {
  from {
    opacity: 0;
    transform: scaleX(0.45);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes dong-pop {
  from {
    opacity: 0;
    transform: scale(0.4);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .yao,
  .yao.dong::after {
    animation-duration: 0.01ms !important;
    animation-delay: 0ms !important;
  }
}
</style>
