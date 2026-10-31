<script setup lang="ts">
/**
 * 氛围背景（固定最底层）
 *
 * 纪律：纯装饰、不参与交互、不响应指针；动效只走 opacity / transform。
 * 低端机（body.low-end）与 reduced-motion 下由 base.css 全局降级。
 */
</script>

<template>
  <div class="backdrop" aria-hidden="true">
    <div class="glow glow-top" />
    <div class="glow glow-bottom" />
    <div class="grid" />
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}
.glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(28px);
}
.glow-top {
  left: -18%;
  top: -12%;
  width: 130%;
  height: 46%;
  background: radial-gradient(closest-side, rgba(192, 72, 60, 0.16), transparent 70%);
}
.glow-bottom {
  left: -10%;
  bottom: -18%;
  width: 120%;
  height: 42%;
  background: radial-gradient(closest-side, rgba(168, 137, 79, 0.14), transparent 70%);
}
/* 极淡网格：给平面一点"格物"的秩序感 */
.grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(to right, rgba(236, 232, 241, 0.035) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(236, 232, 241, 0.035) 1px, transparent 1px);
  background-size: 0.26rem 0.26rem;
}
</style>
