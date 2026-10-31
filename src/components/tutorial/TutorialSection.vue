<script setup lang="ts">
/** 教程区块壳：锚点 + 标题 + 可选副标题 + 内容 slot（JY-14 §3.2 / §3.4） */
defineProps<{
  id: string
  title: string
  /** 副标题 / 摘要（可选，折叠态展示） */
  subtitle?: string
}>()
defineSlots<{ default: unknown }>()
</script>

<template>
  <section :id="id" class="tutorial-section">
    <h2 class="section-head">
      <span class="section-anchor" aria-hidden="true">§</span>
      <span class="section-title">{{ title }}</span>
    </h2>
    <p v-if="subtitle" class="section-sub">{{ subtitle }}</p>
    <div class="section-body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.tutorial-section {
  scroll-margin-top: 0.5rem;
  padding: 0.16rem 0.04rem 0.3rem;
  border-bottom: 1px dashed var(--line-soft);
}
.tutorial-section:last-of-type {
  border-bottom: none;
}
.section-head {
  display: flex;
  align-items: center;
  gap: 0.08rem;
  margin-bottom: 0.08rem;
}
.section-anchor {
  color: var(--bronze);
  font-family: var(--font-serif);
  font-size: 0.18rem;
}
.section-title {
  font-family: var(--font-serif);
  font-size: 0.17rem;
  color: var(--cinnabar-bright);
  letter-spacing: 0.02em;
}
.section-sub {
  font-size: 0.11rem;
  color: var(--text-3);
  line-height: 1.6;
  margin-bottom: 0.12rem;
}
.section-body {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}
</style>