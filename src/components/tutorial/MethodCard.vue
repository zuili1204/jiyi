<script setup lang="ts">
import { ref } from 'vue'
import type { TutorialMethod } from '@/data/content/tutorial'
import CategoryIcon from '@/components/CategoryIcon.vue'
import { methodAccent } from '@/types/reading'

/**
 * 单个玩法介绍卡（JY-14 §3.2 / §4.2）
 * 默认折叠仅显示摘要，点卡展开详情。partial 玩法以青铜虚边 +「待完善」徽记如实标注。
 * 品类识别色与列表 / 详情页同源（METHOD_ACCENT）。
 */
defineProps<{ method: TutorialMethod }>()
const open = ref(false)

function toggle() {
  open.value = !open.value
}
</script>

<template>
  <article
    class="method"
    :class="{ open, partial: method.status === 'partial' }"
    role="button"
    tabindex="0"
    :aria-expanded="open"
    :aria-label="`${method.name} 玩法介绍`"
    :style="{ '--accent': methodAccent(method.key) }"
    @click="toggle"
    @keydown.enter.prevent="toggle"
    @keydown.space.prevent="toggle"
  >
    <header class="m-head">
      <span class="m-icon"><CategoryIcon :kind="method.key" :size="26" /></span>
      <div class="m-meta">
        <div class="m-title-row">
          <span class="m-name">{{ method.name }}</span>
          <span class="m-difficulty" :title="`难度 ${method.difficulty}`">{{ method.difficulty }}</span>
          <span v-if="method.status === 'partial'" class="m-badge partial-badge">待完善</span>
          <span v-else class="m-badge ready-badge">可用</span>
        </div>
        <p class="m-clan muted">{{ method.clan }} · {{ method.school }}</p>
      </div>
      <span class="m-caret" aria-hidden="true">{{ open ? '▾' : '▸' }}</span>
    </header>

    <!-- 折叠摘要 -->
    <p v-show="!open" class="m-desc-sum">{{ method.desc }}</p>

    <!-- 展开详情 -->
    <div v-show="open" class="m-body">
      <dl class="m-dl">
        <div class="m-row"><dt>输入</dt><dd>{{ method.input }}</dd></div>
        <div class="m-row"><dt>输出</dt><dd>{{ method.output }}</dd></div>
        <div class="m-row"><dt>常见用于</dt><dd>{{ method.suit.join('、') }}</dd></div>
      </dl>
      <p v-if="method.caution" class="m-caution">注意：{{ method.caution }}</p>
    </div>
  </article>
</template>

<style scoped>
.method {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius);
  background: var(--panel);
  cursor: pointer;
  transition: border-color var(--dur-fast) var(--ease-out),
    background var(--dur-fast) var(--ease-out),
    transform var(--dur-fast) var(--ease-out),
    box-shadow var(--dur-fast) var(--ease-out);
}
.method:hover,
.method:focus-visible {
  border-color: var(--bronze-dim);
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
  outline: none;
}
.method.partial {
  border-style: dashed;
  border-color: var(--bronze-dim);
}
.method.open {
  border-color: var(--accent, var(--cinnabar-dim));
  background: var(--panel-2);
}
.m-head {
  display: flex;
  align-items: center;
  gap: 0.1rem;
  padding: 0.12rem 0.14rem;
}
.m-icon {
  flex: none;
  color: var(--accent, var(--bronze-bright));
}
.method.open .m-icon {
  color: var(--accent, var(--cinnabar-bright));
}
.m-meta {
  flex: 1;
  min-width: 0;
}
.m-title-row {
  display: flex;
  align-items: center;
  gap: 0.07rem;
}
.m-name {
  font-family: var(--font-serif);
  font-size: 0.15rem;
}
.m-difficulty {
  font-size: 0.11rem;
  color: var(--bronze-bright);
  letter-spacing: 0.02em;
}
.m-badge {
  font-size: 0.09rem;
  padding: 0.01rem 0.06rem;
  border-radius: var(--radius-pill);
  border: 1px solid transparent;
}
.ready-badge {
  color: var(--cinnabar-bright);
  border-color: var(--cinnabar-dim);
}
.partial-badge {
  color: var(--bronze-bright);
  border-color: var(--bronze-dim);
  border-style: dashed;
}
.m-clan {
  font-size: 0.1rem;
  margin-top: 0.02rem;
}
.m-caret {
  flex: none;
  color: var(--text-3);
  transition: transform var(--dur-fast) var(--ease-out);
}
.method.open .m-caret {
  transform: rotate(90deg);
}
.m-desc-sum {
  padding: 0 0.14rem 0.12rem;
  font-size: 0.11rem;
  color: var(--text-2);
  line-height: 1.6;
}
.m-body {
  padding: 0 0.14rem 0.14rem;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  animation: m-fade var(--dur-fast) var(--ease-out);
}
@keyframes m-fade {
  from {
    opacity: 0;
    transform: translateY(-0.03rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .m-body {
    animation: none;
  }
}
.m-dl {
  display: flex;
  flex-direction: column;
  gap: 0.06rem;
}
.m-row {
  display: flex;
  gap: 0.1rem;
  font-size: 0.11rem;
  line-height: 1.5;
}
.m-row dt {
  flex: none;
  width: 0.7rem;
  color: var(--text-3);
}
.m-row dd {
  flex: 1;
  color: var(--text-2);
}
.m-caution {
  font-size: 0.1rem;
  color: var(--warn);
  line-height: 1.5;
}
</style>