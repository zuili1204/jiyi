<script setup lang="ts">
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'
import { useToastStore } from '@/stores/toast'
import { PRECISION_STATEMENT } from '@/engine/calendar/constants'
import { loadWebFonts, unloadWebFonts } from '@/platform/fonts'

/**
 * 设置页
 *
 * 纪律：**未落地的能力也要给位置**，点下去明确提示「正在开发中」，
 * 而不是隐藏起来或留一个点了没反应的开关（那比没有更让人困惑）。
 * 已落地的 AI 深度解读走独立设置页（API 类配置不挤主设置页）。
 */
const settings = useSettingsStore()
const toast = useToastStore()
const router = useRouter()

function soon(name: string) {
  toast.show(`「${name}」正在开发中`)
}

function openAi() {
  router.push({ name: 'settings-ai' })
}

/* 联网标题字体：开启后加载，关闭后卸载；失败静默回退系统字体，不打扰用户 */
watch(
  () => settings.webFont,
  async (on) => {
    if (on) {
      const ok = await loadWebFonts()
      if (!ok) toast.show('联网字体未就绪，已使用系统字体')
    } else {
      unloadWebFonts()
    }
  },
  { immediate: true }
)
</script>

<template>
  <div class="page settings">
    <h2 class="section-title">外观</h2>
    <div class="card">
      <label class="item">
        <span>深色主题<small>关闭即切换为浅色</small></span>
        <input
          type="checkbox"
          :checked="settings.theme === 'dark'"
          @change="settings.set('theme', ($event.target as HTMLInputElement).checked ? 'dark' : 'light')"
        />
      </label>
      <label class="item">
        <span>降低动效<small>系统开启「减少动态效果」时自动生效</small></span>
        <input
          type="checkbox"
          :checked="settings.reduceMotion"
          @change="settings.set('reduceMotion', ($event.target as HTMLInputElement).checked)"
        />
      </label>
      <label class="item">
        <span>低性能模式<small>关闭阴影与复杂动画</small></span>
        <input
          type="checkbox"
          :checked="settings.lowEnd"
          @change="settings.set('lowEnd', ($event.target as HTMLInputElement).checked)"
        />
      </label>
      <label class="item">
        <span>联网标题字体<small>默认关：会向第三方字体服务请求；失败自动回退系统字体</small></span>
        <input
          type="checkbox"
          :checked="settings.webFont"
          @change="settings.set('webFont', ($event.target as HTMLInputElement).checked)"
        />
      </label>
    </div>

    <h2 class="section-title">历法</h2>
    <div class="card">
      <label class="item">
        <span>真太阳时<small>按出生地经度订正（默认关）</small></span>
        <input
          type="checkbox"
          :checked="settings.trueSolarTime"
          @change="settings.set('trueSolarTime', ($event.target as HTMLInputElement).checked)"
        />
      </label>
      <p class="note">{{ PRECISION_STATEMENT }}</p>
    </div>

    <h2 class="section-title">实验室</h2>
    <div class="card">
      <button type="button" class="item link" @click="openAi">
        <span>AI 深度解读<small>提供白话转述，不作额外解读（BYOK）</small></span>
        <span class="chev" aria-hidden="true">›</span>
      </button>
      <button type="button" class="item link" @click="soon('声音')">
        <span>声音<small>摇卦 / 落签音效</small></span>
        <span class="chev" aria-hidden="true">›</span>
      </button>
    </div>

    <h2 class="section-title">关于</h2>
    <div class="card">
      <p class="note">
        本应用为传统文化研究工具，结果源于算法与公开典籍，不构成任何医疗、投资、法律建议。
      </p>
      <p class="note">卦爻辞与纳甲表尚未过权威核校，结果页已标注，仅供参玩。</p>
      <p class="note">社会主义核心价值观：</p>
      <p class="note">富强、民主、文明、和谐</p>
      <p class="note">自由、平等、公正、法制</p>
      <p class="note">爱国、敬业、诚信、友善</p>
      <p class="note">党政军民学，东南西北中，中国共产党是领导一切的。</p>
    </div>
  </div>
</template>

<style scoped>
.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.1rem;
  min-height: 0.48rem;
  padding: 0.06rem 0;
  font-size: 0.14rem;
  width: 100%;
  text-align: left;
  border-bottom: 1px solid var(--line-soft);
}
.item:last-child {
  border-bottom: none;
}
.item small {
  display: block;
  font-size: 0.11rem;
  color: var(--text-3);
  line-height: 1.5;
}
.item input[type='checkbox'] {
  appearance: none;
  width: 0.44rem;
  height: 0.26rem;
  flex: none;
  border-radius: var(--radius-pill);
  background: var(--line-soft);
  position: relative;
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease-out);
}
.item input[type='checkbox']::after {
  content: '';
  position: absolute;
  top: 0.03rem;
  left: 0.03rem;
  width: 0.2rem;
  height: 0.2rem;
  border-radius: 50%;
  background: var(--text-2);
  transition: transform var(--dur-fast) var(--ease-out);
}
.item input[type='checkbox']:checked {
  background: var(--cinnabar);
}
.item input[type='checkbox']:checked::after {
  transform: translateX(0.18rem);
  background: #fff;
}
.item.link .chev {
  color: var(--text-3);
  font-size: 0.18rem;
}
.note {
  font-size: 0.12rem;
  color: var(--text-2);
  line-height: 1.7;
  margin-top: 0.06rem;
}
</style>
