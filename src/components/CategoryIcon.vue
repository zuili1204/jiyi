<script setup lang="ts">
/**
 * 品类徽记（纯 SVG，不用 emoji —— emoji 在各平台字形不一，且不受主题色控制）
 */
withDefaults(defineProps<{ kind: string; size?: number }>(), { size: 26 })
</script>

<template>
  <svg
    class="icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <!-- 签占：签筒与签 -->
    <template v-if="kind === 'lots'">
      <path d="M9 3v9M12 2v10M15 3v9" />
      <path d="M7 13h10l-1 7a2 2 0 0 1-2 1.6h-4A2 2 0 0 1 8 20z" />
    </template>

    <!-- 六爻：三爻（乾象） -->
    <template v-else-if="kind === 'liujiao'">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </template>

    <!-- 梅花：五点花 -->
    <template v-else-if="kind === 'meihua'">
      <circle cx="12" cy="6.4" r="2.2" />
      <circle cx="17.4" cy="10.6" r="2.2" />
      <circle cx="15.2" cy="17" r="2.2" />
      <circle cx="8.8" cy="17" r="2.2" />
      <circle cx="6.6" cy="10.6" r="2.2" />
    </template>

    <!-- 八字：四柱 -->
    <template v-else-if="kind === 'bazi'">
      <path d="M4 4v16M9.6 4v16M15.2 4v16M20.8 4v16" />
      <path d="M4 9h5.6M9.6 13h5.6M15.2 8h5.6" />
    </template>

    <!-- 紫微：星 -->
    <template v-else-if="kind === 'ziwei'">
      <path d="M12 3l2.2 6.6L21 12l-6.8 2.4L12 21l-2.2-6.6L3 12l6.8-2.4z" />
    </template>

    <!-- 奇门：九宫 -->
    <template v-else-if="kind === 'qimen'">
      <path d="M3 3h18v18H3z" />
      <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
    </template>

    <!-- 兜底：问号圆 -->
    <template v-else>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .9-1 1.6v.4" />
      <path d="M12 17h.01" />
    </template>
  </svg>
</template>

<style scoped>
.icon {
  display: block;
  flex: none;
}
</style>
