import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  clearAiConfig,
  loadAiConfig,
  saveAiConfig,
  type AiConfig
} from '@/platform/storage'
import { aiProviderById } from '@/data/ai-providers'

/**
 * AI 配置 store（JY-07 §3）
 *
 * 纪律：
 * - 未经知情弹窗确认不得启用（storage.loadAiConfig 已兜底）；
 * - 一键清除 = 整包移除 `jiyi.ai.v1`，密钥不留痕；
 * - 切换服务商时带入该服务商的 baseUrl 与默认模型，密钥保留由用户自行核对。
 */
export const useAiStore = defineStore('ai', () => {
  const config = ref<AiConfig>(loadAiConfig())

  const ready = computed(
    () => config.value.enabled && !!config.value.apiKey && !!config.value.baseUrl && !!config.value.model
  )

  function update(patch: Partial<AiConfig>) {
    config.value = { ...config.value, ...patch }
    // 写入失败（空间不足 / 不可用）只记日志：内存态已更新，本次会话仍可正常请求
    try {
      saveAiConfig(config.value)
    } catch (e) {
      console.warn('[jiyi] AI 配置保存失败：', e)
    }
  }

  /** 知情弹窗确认：记录时间，方可启用 */
  function acknowledge() {
    update({ acknowledgedAt: Date.now(), enabled: true })
  }

  /** 切换服务商：只带入预设 baseUrl；模型名由用户自由填写，不预设档位 */
  function setProvider(id: string) {
    const p = aiProviderById(id)
    if (!p) return
    update({
      provider: p.id,
      baseUrl: p.baseUrl
    })
  }

  /** 一键清除密钥：整包移除后重载（回到未配置态） */
  function clearKey() {
    clearAiConfig()
    config.value = loadAiConfig()
  }

  return { config, ready, update, acknowledge, setProvider, clearKey }
})
