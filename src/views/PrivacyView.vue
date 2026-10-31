<script setup lang="ts">
import { useRouter } from 'vue-router'
import {
  DISCLAIMER,
  POLICY_CONTACT,
  PRIVACY_POLICY,
  PRIVACY_UPDATED_AT,
  PRIVACY_VERSION
} from '@/data/legal'

/**
 * 隐私政策页（Y7-08 / JY-04 §5.2 七条）
 *
 * 纪律：
 * - 文本**只有一个出处**（`src/data/legal.ts`），本页不做任何"更正式"的改写；
 * - 主体名称 / 邮箱未确定前显示「待填」，**不编造**（《拼豆》经验：占位要在第一天就位）；
 * - 免责声明与商店、关于页共用同一份措辞。
 */
const router = useRouter()

function back() {
  if (typeof window !== 'undefined' && window.history.length > 1) router.back()
  else router.replace({ name: 'settings' })
}
</script>

<template>
  <div class="page privacy">
    <header class="bar">
      <button type="button" class="back" @click="back">‹ 返回</button>
    </header>

    <h2 class="section-title">隐私政策</h2>
    <p class="muted">版本 {{ PRIVACY_VERSION }} · 生效日期 {{ PRIVACY_UPDATED_AT }}</p>

    <article v-for="s in PRIVACY_POLICY" :key="s.key" class="card sec">
      <h3>{{ s.title }}</h3>
      <p class="body">{{ s.body }}</p>
    </article>

    <h2 class="section-title">免责声明</h2>
    <div class="card">
      <p class="body">{{ DISCLAIMER }}</p>
    </div>

    <h2 class="section-title">运营主体与联系</h2>
    <div class="card">
      <p class="body">运营主体：{{ POLICY_CONTACT.operator }}</p>
      <p class="body">联系邮箱：{{ POLICY_CONTACT.email }}</p>
      <p class="muted">未填写前一律留白，不以占位内容冒充真实主体信息。</p>
    </div>
  </div>
</template>

<style scoped>
.privacy {
  position: relative;
  z-index: 1;
}
.bar {
  display: flex;
  margin-bottom: 0.06rem;
}
.back {
  min-height: 0.44rem;
  padding: 0 0.12rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--line-soft);
  color: var(--text-2);
  font-size: 0.13rem;
}
.sec {
  margin-bottom: 0.08rem;
}
h3 {
  font-size: 0.14rem;
  margin-bottom: 0.04rem;
}
.body {
  font-size: 0.13rem;
  line-height: 1.8;
  color: var(--text-2);
  white-space: pre-wrap;
}
</style>
