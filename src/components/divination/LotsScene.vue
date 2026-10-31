<script setup lang="ts">
/**
 * 签占场景：签筒摇签。
 * 循环段——签筒左右甩动、筒口签簇跳动，是「摇」的声与形；
 * 落定段——筒身停正，一支签自筒中缓缓升起，签头朱砂、签号浮现。
 */
import { computed } from 'vue'

const props = defineProps<{
  phase: 'loop' | 'settle'
  data?: Record<string, unknown>
}>()

/** 落定段的真实签号（引擎结果 index: 1–100） */
const no = computed(() => {
  const v = (props.data as { index?: unknown } | undefined)?.index
  return typeof v === 'number' ? v : null
})
const noLabel = computed(() => (no.value === null ? '签' : `第 ${no.value} 签`))
</script>

<template>
  <div class="scene lots" aria-hidden="true">
    <div class="tube-zone" :class="phase">
      <!-- 签簇：筒口露头的签 -->
      <i v-for="i in 7" :key="i" class="stick" :class="`s${i}`"></i>
      <!-- 落定：升起的那支签 -->
      <div v-if="phase === 'settle'" class="riser">
        <span class="no">{{ noLabel }}</span>
      </div>
      <!-- 筒身 -->
      <div class="body">
        <span class="mark">签</span>
        <i class="hoop h1"></i>
        <i class="hoop h2"></i>
      </div>
      <i class="shadow"></i>
    </div>
  </div>
</template>

<style scoped>
.scene {
  display: flex;
  justify-content: center;
}
.tube-zone {
  position: relative;
  width: 0.9rem;
  height: 1.5rem;
}

/* 签簇：从筒口探出的细签 */
.stick {
  position: absolute;
  bottom: 0.68rem;
  width: 0.035rem;
  border-radius: 0.02rem;
  background: var(--bronze-bright);
  transform-origin: bottom center;
  z-index: 1;
}
.s1 { left: 0.16rem; height: 0.3rem; transform: rotate(-4deg); }
.s2 { left: 0.24rem; height: 0.38rem; transform: rotate(2deg); }
.s3 { left: 0.32rem; height: 0.28rem; transform: rotate(-2deg); }
.s4 { left: 0.42rem; height: 0.42rem; transform: rotate(3deg); }
.s5 { left: 0.52rem; height: 0.32rem; transform: rotate(-3deg); }
.s6 { left: 0.6rem; height: 0.37rem; transform: rotate(4deg); }
.s7 { left: 0.68rem; height: 0.27rem; transform: rotate(-1deg); }

/* 落定：升起的那支签（基础态即最终位置，动画从筒内升起） */
.riser {
  position: absolute;
  bottom: 0.66rem;
  left: 50%;
  margin-left: -0.03rem;
  width: 0.06rem;
  height: 0.85rem;
  border-radius: 0.03rem;
  background: var(--bronze-bright);
  z-index: 1;
  animation: rise 0.5s var(--ease-spring) both;
}
/* 签头朱砂 */
.riser::before {
  content: '';
  position: absolute;
  top: -0.035rem;
  left: 50%;
  transform: translateX(-50%);
  width: 0.075rem;
  height: 0.075rem;
  border-radius: 50%;
  background: var(--cinnabar-bright);
}
.no {
  position: absolute;
  left: 55%;
  top: -0.28rem;
  white-space: nowrap;
  font-family: var(--font-serif);
  font-size: 0.13rem;
  letter-spacing: 0.03em;
  color: var(--text);
  animation: no-in 0.28s var(--ease-out) 0.38s both;
}

/* 筒身：盖住签与签的下段 */
.body {
  position: absolute;
  bottom: 0;
  left: 50%;
  margin-left: -0.33rem;
  width: 0.66rem;
  height: 0.78rem;
  border-radius: 0.07rem 0.07rem 0.13rem 0.13rem;
  border: 1px solid var(--bronze-dim);
  background: linear-gradient(180deg, var(--panel-2), var(--bg-2));
  box-shadow: 0 0.03rem 0.08rem rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}
.mark {
  font-family: var(--font-serif);
  font-size: 0.2rem;
  color: var(--bronze-bright);
}
.hoop {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--bronze-dim);
}
.hoop.h1 { top: 18%; }
.hoop.h2 { top: 80%; }

.shadow {
  position: absolute;
  bottom: -0.07rem;
  left: 50%;
  margin-left: -0.36rem;
  width: 0.72rem;
  height: 0.07rem;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.35);
}

/* 循环段：抱筒甩动 + 签簇咯咯跳动 */
.loop {
  transform-origin: 50% 96%;
  animation: tilt 0.95s ease-in-out infinite;
}
.loop .stick {
  animation: rattle 0.5s ease-in-out infinite alternate;
}
.s1 { animation-delay: 0s; }
.s2 { animation-delay: 0.07s; }
.s3 { animation-delay: 0.14s; }
.s4 { animation-delay: 0.03s; }
.s5 { animation-delay: 0.11s; }
.s6 { animation-delay: 0.05s; }
.s7 { animation-delay: 0.09s; }

@keyframes tilt {
  0% { transform: rotate(0deg); }
  18% { transform: rotate(11deg); }
  38% { transform: rotate(-9deg); }
  58% { transform: rotate(13deg); }
  78% { transform: rotate(-7deg); }
  100% { transform: rotate(0deg); }
}
@keyframes rattle {
  from { margin-bottom: 0; }
  to { margin-bottom: 0.045rem; }
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(0.05rem);
  }
  to {
    opacity: 1;
    transform: translateY(-0.42rem);
  }
}
@keyframes no-in {
  from {
    opacity: 0;
    transform: translateY(-0.06rem);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .loop,
  .loop .stick,
  .riser,
  .no {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
</style>
