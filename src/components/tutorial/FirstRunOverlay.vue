<script setup lang="ts">
import { ref } from 'vue'
import { loadOnboarding, saveOnboarding } from '@/platform/storage'

/**
 * 首启轻引导遮罩（JY-14 §3.1 C 方案）
 * 2~3 屏圆点指示 + 左右滑动；可「跳过」或勾选「不再提示」后关闭。
 * 状态写入 `jiyi.onboarding.v1`（didSee / dismissed），刷新不重弹、返回后重置。
 */
const pages = [
  { title: '稽疑是什么', text: '一款国学 / 易学文化、自我探索与休闲娱乐的离线小工具，不含算命断语。' },
  { title: '怎么开始', text: '回到首页，在六个玩法中按需点选，即可开始。' },
  { title: '有疑问？', text: '看看底部「教程」页，六个功能的介绍与"怎么选"都在里面。' }
]
const page = ref(0)
const dismissForever = ref(false)

const emit = defineEmits<{ (e: 'finish'): void }>()

function persist() {
  const cur = loadOnboarding()
  saveOnboarding({
    ...cur,
    tookTutorial: true,
    tutorialDismissed: cur.tutorialDismissed || dismissForever.value
  })
}

function next() {
  if (page.value < pages.length - 1) page.value++
  else finish()
}
function prev() {
  if (page.value > 0) page.value--
}
function finish() {
  persist()
  emit('finish')
}
function skip() {
  persist()
  emit('finish')
}
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" aria-label="新手引导">
    <div class="stage">
      <div class="pages" :style="{ transform: `translateX(-${page * 100}%)` }">
        <div v-for="(p, i) in pages" :key="i" class="page">
          <h2 class="ov-title">{{ p.title }}</h2>
          <p class="ov-text">{{ p.text }}</p>
        </div>
      </div>
      <div class="dots">
        <span
          v-for="(_, i) in pages"
          :key="i"
          class="dot"
          :class="{ on: i === page }"
          :aria-hidden="true"
        />
      </div>
      <div class="ov-actions">
        <button v-if="page > 0" type="button" class="ghost" @click="prev">上一页</button>
        <label class="nomore">
          <input v-model="dismissForever" type="checkbox" />
          不再提示
        </label>
        <div class="ov-right">
          <button type="button" class="ghost" @click="skip">跳过</button>
          <button type="button" class="primary" @click="next">
            {{ page === pages.length - 1 ? '开始' : '下一页' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.2rem;
  background: rgba(6, 5, 10, 0.82);
  backdrop-filter: blur(6px);
}
.stage {
  width: 100%;
  max-width: var(--app-max);
  overflow: hidden;
  padding: 0.2rem 0.16rem 0.14rem;
  border-radius: var(--radius);
  border: 1px solid var(--line);
  background: var(--panel);
}
.pages {
  display: flex;
  width: 100%;
  transition: transform var(--dur-slow) var(--ease-out);
}
.page {
  flex: 0 0 100%;
  padding: 0.06rem 0;
}
.ov-title {
  font-family: var(--font-serif);
  font-size: 0.18rem;
  color: var(--cinnabar-bright);
  margin-bottom: 0.1rem;
}
.ov-text {
  font-size: 0.13rem;
  color: var(--text-2);
  line-height: 1.7;
}
.dots {
  display: flex;
  justify-content: center;
  gap: 0.06rem;
  margin: 0.14rem 0 0.12rem;
}
.dot {
  width: 0.06rem;
  height: 0.06rem;
  border-radius: 50%;
  background: var(--line-soft);
}
.dot.on {
  background: var(--cinnabar);
}
.ov-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.1rem;
}
.nomore {
  display: inline-flex;
  align-items: center;
  gap: 0.04rem;
  font-size: 0.11rem;
  color: var(--text-3);
  cursor: pointer;
}
.ov-right {
  display: flex;
  gap: 0.08rem;
}
.ghost {
  min-height: 0.44rem;
  padding: 0 0.14rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--line-soft);
  color: var(--text-2);
  font-size: 0.12rem;
  cursor: pointer;
}
.ghost:hover {
  color: var(--cinnabar-bright);
}
.primary {
  min-height: 0.44rem;
  padding: 0 0.18rem;
  border-radius: var(--radius-pill);
  border: 1px solid transparent;
  background: var(--cinnabar);
  color: #fff;
  font-size: 0.12rem;
  cursor: pointer;
}
</style>