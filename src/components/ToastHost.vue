<script setup lang="ts">
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
</script>

<template>
  <transition name="toast">
    <div v-if="toast.message" class="toast" role="status" aria-live="polite">
      {{ toast.message }}
    </div>
  </transition>
</template>

<style scoped>
.toast {
  position: fixed;
  left: 50%;
  bottom: calc(0.92rem + var(--safe-bottom));
  transform: translateX(-50%);
  /* 与 #app 同宽：宽屏下 82vw 远宽于内容列，提示会溢出窄列两侧 */
  max-width: min(82vw, calc(var(--app-max) - 0.36rem));
  padding: 0.09rem 0.18rem;
  border-radius: var(--radius-pill);
  background: rgba(18, 16, 26, 0.94);
  border: 1px solid var(--cinnabar-dim);
  color: var(--text);
  font-size: 0.13rem;
  text-align: center;
  z-index: 120;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
}
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity var(--dur-base) var(--ease-out),
    transform var(--dur-base) var(--ease-out);
}
.toast-enter-from {
  opacity: 0;
  transform: translate(-50%, 8px);
}
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -4px);
}
</style>
