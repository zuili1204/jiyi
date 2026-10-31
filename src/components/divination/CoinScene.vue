<script setup lang="ts">
/**
 * 六爻场景：三枚铜钱摇卦。
 * 循环段——三钱在掌中翻滚起落（摇卦的手感）；
 * 落定段——钱影退淡，六爻自下而上堆叠成卦（阳爻整、阴爻断、动爻朱砂点），卦名浮现。
 */
import { computed } from 'vue'
import HexBars from './HexBars.vue'

const props = defineProps<{
  phase: 'loop' | 'settle'
  data?: Record<string, unknown>
}>()

/** 落定段的真实卦象（cast.lines 自下而上，true=阳；dongYao 动爻位 1–6） */
const cast = computed(
  () =>
    (
      props.data as
        | {
            cast?: { lines?: unknown; dongYao?: unknown; benGua?: { name?: unknown } }
          }
        | undefined
    )?.cast
)
const lines = computed(() => {
  const l = cast.value?.lines
  return Array.isArray(l) && l.length === 6 ? (l as boolean[]) : []
})
const dong = computed(() => {
  const d = cast.value?.dongYao
  return Array.isArray(d) ? (d as number[]) : []
})
const guaName = computed(() =>
  typeof cast.value?.benGua?.name === 'string' ? cast.value.benGua.name : ''
)
</script>

<template>
  <div class="scene coin" aria-hidden="true">
    <div class="coins" :class="phase">
      <i class="c c1"><b></b></i>
      <i class="c c2"><b></b></i>
      <i class="c c3"><b></b></i>
      <i class="ground"></i>
    </div>
    <div v-if="phase === 'settle' && lines.length" class="hex-wrap">
      <HexBars :lines="lines" :moving="dong" />
      <p v-if="guaName" class="gua">{{ guaName }}</p>
    </div>
  </div>
</template>

<style scoped>
.scene {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.16rem;
}
.coins {
  position: relative;
  width: 1.4rem;
  height: 0.52rem;
}

/* 铜钱：圆身方孔 */
.c {
  position: absolute;
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  border: 1px solid var(--bronze-dim);
  background: radial-gradient(circle at 35% 30%, var(--bronze-bright), var(--bronze));
  box-shadow: 0 0.02rem 0.05rem rgba(0, 0, 0, 0.35);
}
.c b {
  position: absolute;
  left: 50%;
  top: 50%;
  margin: -0.05rem 0 0 -0.05rem;
  width: 0.1rem;
  height: 0.1rem;
  border: 1px solid var(--bronze-dim);
  background: var(--panel);
}
.c1 { left: 0.12rem; top: 0.1rem; }
.c2 { left: 0.5rem; top: 0.02rem; }
.c3 { left: 0.88rem; top: 0.12rem; }

.ground {
  position: absolute;
  bottom: -0.12rem;
  left: 50%;
  margin-left: -0.6rem;
  width: 1.2rem;
  height: 0.08rem;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.35);
}

.hex-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  animation: hex-in 0.3s var(--ease-out) 0.15s both;
}
.gua {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 0.14rem;
  letter-spacing: 0.08em;
  color: var(--bronze-bright);
  animation: gua-in 0.3s var(--ease-out) 0.8s both;
}

/* 循环段：三钱翻滚起落，落点错开 */
.loop .c {
  animation: toss 0.85s ease-in-out infinite;
}
.loop .c2 { animation-delay: 0.14s; }
.loop .c3 { animation-delay: 0.28s; }
.loop .ground {
  animation: ground-breathe 0.85s ease-in-out infinite;
}

/* 落定段：钱影退淡，把台面让给卦 */
.settle .c {
  animation: rest 0.35s ease-out both;
}
.settle .ground {
  animation: ground-fade 0.35s ease-out both;
}

@keyframes toss {
  0% { transform: translateY(0) rotateY(0deg); }
  45% { transform: translateY(-0.22rem) rotateY(200deg); }
  100% { transform: translateY(0) rotateY(360deg); }
}
@keyframes ground-breathe {
  0%, 100% { transform: scaleX(1); opacity: 1; }
  45% { transform: scaleX(0.72); opacity: 0.55; }
}
@keyframes rest {
  from { opacity: 1; transform: none; }
  to { opacity: 0.18; transform: translateY(0.04rem); }
}
@keyframes ground-fade {
  from { opacity: 1; }
  to { opacity: 0.2; }
}
@keyframes hex-in {
  from { opacity: 0; transform: translateY(0.08rem); }
  to { opacity: 1; transform: none; }
}
@keyframes gua-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .loop .c,
  .loop .ground,
  .settle .c,
  .settle .ground,
  .hex-wrap,
  .gua {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    animation-delay: 0ms !important;
  }
}
</style>
