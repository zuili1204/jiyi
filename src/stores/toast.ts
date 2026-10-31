import { ref } from 'vue'
import { defineStore } from 'pinia'

/**
 * 轻提示 store（全局单例）
 *
 * 用途：未开发功能的占位反馈、操作结果提示。
 * 纪律：提示是**短句**，不承担错误信息以外的长文案；错误另说。
 */
export const useToastStore = defineStore('toast', () => {
  const message = ref('')
  let timer: number | undefined

  function show(msg: string, duration = 2200) {
    message.value = msg
    if (timer) window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      message.value = ''
    }, duration)
  }

  function clear() {
    if (timer) window.clearTimeout(timer)
    message.value = ''
  }

  return { message, show, clear }
})
