<script setup lang="ts">
/**
 * 占卜仪式舞台：按玩法分发到具象场景（签筒摇签 / 铜钱掷爻 / 梅花触机 /
 * 四柱立起 / 十二宫安星 / 天盘转九宫）。
 *
 * 两段节奏：
 * - 循环段（phase=loop）：演玩法的过程感，等待问卦人按下「停」；
 * - 落定段（phase=settle）：用已定的真实结果定格盘面，约 0.9s 后由父级进详情页。
 *
 * 只做氛围与过程可视化，不含业务逻辑；降级（reduceMotion / lowEnd）时
 * 父级根本不会渲染本组件（0 等待直接出结果），自身再做 CSS 层兜底降级。
 */
import { computed } from 'vue'
import type { Component } from 'vue'
import LotsScene from './LotsScene.vue'
import CoinScene from './CoinScene.vue'
import PlumScene from './PlumScene.vue'
import BaziScene from './BaziScene.vue'
import ZiweiScene from './ZiweiScene.vue'
import QimenScene from './QimenScene.vue'

const props = defineProps<{
  mode: string
  phase: 'loop' | 'settle'
  data?: Record<string, unknown>
  label: string
}>()

/** 品类 → 具象场景组件 */
const SCENES: Record<string, Component> = {
  lots: LotsScene,
  liujiao: CoinScene,
  meihua: PlumScene,
  bazi: BaziScene,
  ziwei: ZiweiScene,
  qimen: QimenScene
}
const scene = computed(() => SCENES[props.mode] ?? LotsScene)

/** 循环段的一句口径（落定段不再重复说明） */
const SUB: Record<string, string> = {
  lots: '三签取一 · 心诚则灵',
  liujiao: '三枚铜钱 · 六爻成卦',
  meihua: '触机而取 · 体用互变',
  bazi: '四柱排盘 · 五行流转',
  ziwei: '定命安星 · 四化分列',
  qimen: '布九宫 · 起天盘八门'
}
const sub = computed(() => (props.phase === 'loop' ? SUB[props.mode] ?? '' : ''))
</script>

<template>
  <div class="stage" role="status" aria-live="polite">
    <component :is="scene" :phase="phase" :data="data" />
    <p class="label">{{ label }}</p>
    <p v-if="sub" class="sub">{{ sub }}</p>
  </div>
</template>

<style scoped>
.stage {
  padding: 0.26rem 0.14rem 0.2rem;
  border-radius: var(--radius);
  border: 1px solid var(--line-soft);
  background: radial-gradient(closest-side, rgba(192, 72, 60, 0.1), var(--panel) 78%);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.12rem;
}
.label {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 0.15rem;
  letter-spacing: 0.05em;
  color: var(--text);
}
.sub {
  margin: 0;
  font-size: 0.11rem;
  color: var(--text-3);
  letter-spacing: 0.04em;
}
</style>
