<script setup lang="ts">
/**
 * 梅花场景：触机而取。
 * 循环段——八卦符绕「梅心」游走明灭，梅花五瓣呼吸（不动不占，机在游走中）；
 * 落定段——符影散去，本卦六爻定格（动爻朱砂点），体 / 用两宫分列卦侧。
 */
import { computed } from 'vue'
import HexBars from './HexBars.vue'

const props = defineProps<{
  phase: 'loop' | 'settle'
  data?: Record<string, unknown>
}>()

interface MeiData {
  cast?: { lines?: unknown; dongYao?: unknown }
  meihua?: {
    benGua?: { name?: unknown; upper?: unknown; lower?: unknown }
    ti?: { trigram?: unknown }
    yong?: { trigram?: unknown }
  }
}

const result = computed(
  () => (props.data as MeiData | undefined)
)
const lines = computed(() => {
  const l = result.value?.cast?.lines
  return Array.isArray(l) && l.length === 6 ? (l as boolean[]) : []
})
const dong = computed(() => {
  const d = result.value?.cast?.dongYao
  return Array.isArray(d) ? (d as number[]) : []
})
const guaName = computed(() =>
  typeof result.value?.meihua?.benGua?.name === 'string'
    ? result.value.meihua.benGua.name
    : ''
)
const upper = computed(() =>
  typeof result.value?.meihua?.benGua?.upper === 'string'
    ? result.value.meihua.benGua.upper
    : ''
)
const lower = computed(() =>
  typeof result.value?.meihua?.benGua?.lower === 'string'
    ? result.value.meihua.benGua.lower
    : ''
)
/** 用卦=动爻所在之卦：动爻在上三爻（4–6）则上卦为用，否则下卦为用 */
const upperRole = computed(() => {
  const yong = result.value?.meihua?.yong?.trigram
  if (yong === upper.value && typeof yong === 'string') return '用'
  if (yong === lower.value && typeof yong === 'string') return '体'
  return dong.value.some((d) => d >= 4) ? '用' : '体'
})
const lowerRole = computed(() => (upperRole.value === '用' ? '体' : '用'))

/** 循环段游走的卦符（八卦取六，留白生呼吸） */
const SYMBOLS = ['☰', '☱', '☲', '☳', '☴', '☵']
</script>

<template>
  <div class="scene plum" aria-hidden="true">
    <!-- 循环段：卦符游走 + 梅心五瓣 -->
    <div class="orbit" :class="phase">
      <span class="heart">
        <i class="petal p1"></i>
        <i class="petal p2"></i>
        <i class="petal p3"></i>
        <i class="petal p4"></i>
        <i class="petal p5"></i>
        <i class="core-dot"></i>
      </span>
      <span v-for="(s, i) in SYMBOLS" :key="s" class="sym" :class="`y${i}`">
        <em>{{ s }}</em>
      </span>
    </div>

    <!-- 落定段：本卦定格 + 体用 -->
    <div v-if="phase === 'settle' && lines.length" class="hex-wrap">
      <div class="hex-row">
        <HexBars :lines="lines" :moving="dong" />
        <div class="roles">
          <span v-if="upper" class="role" :class="{ yong: upperRole === '用' }">
            {{ upperRole }} · {{ upper }}
          </span>
          <span v-if="lower" class="role" :class="{ yong: lowerRole === '用' }">
            {{ lowerRole }} · {{ lower }}
          </span>
        </div>
      </div>
      <p v-if="guaName" class="gua">{{ guaName }}</p>
    </div>
  </div>
</template>

<style scoped>
.scene {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.14rem;
}
.orbit {
  position: relative;
  width: 1.3rem;
  height: 1.3rem;
}

/* 梅心：五瓣 + 蕊 */
.heart {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 0;
  height: 0;
}
.petal {
  position: absolute;
  left: -0.03rem;
  top: -0.03rem;
  width: 0.06rem;
  height: 0.06rem;
  border-radius: 50%;
  background: var(--wx-wood);
}
.p1 { transform: rotate(0deg) translateY(-0.13rem); }
.p2 { transform: rotate(72deg) translateY(-0.13rem); }
.p3 { transform: rotate(144deg) translateY(-0.13rem); }
.p4 { transform: rotate(216deg) translateY(-0.13rem); }
.p5 { transform: rotate(288deg) translateY(-0.13rem); }
.core-dot {
  position: absolute;
  left: -0.025rem;
  top: -0.025rem;
  width: 0.05rem;
  height: 0.05rem;
  border-radius: 50%;
  background: var(--bronze-bright);
}

/* 游走卦符：外圈六符，明灭错落 */
.sym {
  position: absolute;
  left: 50%;
  top: 50%;
  font-size: 0.15rem;
  color: var(--text-2);
}
.y0 { transform: translate(-50%, -50%) rotate(0deg) translateY(-0.5rem); }
.y1 { transform: translate(-50%, -50%) rotate(60deg) translateY(-0.5rem); }
.y2 { transform: translate(-50%, -50%) rotate(120deg) translateY(-0.5rem); }
.y3 { transform: translate(-50%, -50%) rotate(180deg) translateY(-0.5rem); }
.y4 { transform: translate(-50%, -50%) rotate(240deg) translateY(-0.5rem); }
.y5 { transform: translate(-50%, -50%) rotate(300deg) translateY(-0.5rem); }
.sym em {
  display: block;
  font-style: normal;
  font-family: var(--font-serif);
  animation: drift 2.1s ease-in-out infinite alternate;
}

.hex-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  animation: hex-in 0.3s var(--ease-out) 0.15s both;
}
.hex-row {
  display: flex;
  align-items: center;
  gap: 0.14rem;
}
.roles {
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
}
.role {
  font-size: 0.11rem;
  letter-spacing: 0.04em;
  line-height: 1;
  padding: 0.035rem 0.07rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--line-soft);
  color: var(--wx-wood);
  white-space: nowrap;
  animation: role-in 0.28s var(--ease-out) 0.75s both;
}
.role:nth-child(2) { animation-delay: 0.85s; }
.role.yong {
  color: var(--bronze-bright);
}
.gua {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 0.14rem;
  letter-spacing: 0.08em;
  color: var(--bronze-bright);
  animation: gua-in 0.3s var(--ease-out) 0.85s both;
}

/* 循环段：符游走、瓣呼吸 */
.loop .sym em { animation-duration: 2.1s; }
.loop .petal {
  animation: blink 1.7s ease-in-out infinite;
}
.p1 { animation-delay: 0s; }
.p2 { animation-delay: 0.2s; }
.p3 { animation-delay: 0.4s; }
.p4 { animation-delay: 0.6s; }
.p5 { animation-delay: 0.8s; }
.loop .core-dot {
  animation: blink 1.7s ease-in-out 1s infinite;
}
/* 落定段：符影散去，梅心守在卦侧 */
.settle .sym {
  animation: sym-out 0.3s ease-out both;
}

.y0 em { animation-delay: 0s; }
.y1 em { animation-delay: 0.3s; }
.y2 em { animation-delay: 0.6s; }
.y3 em { animation-delay: 0.9s; }
.y4 em { animation-delay: 1.2s; }
.y5 em { animation-delay: 1.5s; }

@keyframes drift {
  from { opacity: 0.3; transform: translateY(-0.04rem); }
  to { opacity: 0.95; transform: translateY(0.04rem); }
}
@keyframes blink {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}
@keyframes sym-out {
  from { opacity: 1; }
  to { opacity: 0; }
}
@keyframes hex-in {
  from { opacity: 0; transform: translateY(0.08rem); }
  to { opacity: 1; transform: none; }
}
@keyframes role-in {
  from { opacity: 0; transform: translateX(0.06rem); }
  to { opacity: 1; transform: none; }
}
@keyframes gua-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .loop .sym em,
  .loop .petal,
  .loop .core-dot,
  .settle .sym,
  .hex-wrap,
  .role,
  .gua {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    animation-delay: 0ms !important;
  }
}
</style>
