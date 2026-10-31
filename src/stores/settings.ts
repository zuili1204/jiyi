import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type AppSettings
} from '@/platform/storage'

/**
 * 设置 store（JY-03 §10）
 * 真太阳时开关、主题、动效降级、低性能模式、声音。
 */
export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>(loadSettings())

  const trueSolarTime = computed(() => settings.value.trueSolarTime)
  const lowEnd = computed(() => settings.value.lowEnd)
  const reduceMotion = computed(() => settings.value.reduceMotion)
  const theme = computed(() => settings.value.theme)
  const webFont = computed(() => settings.value.webFont)
  const birthDataConsent = computed(() => settings.value.birthDataConsent === true)

  /**
   * 持久化兜底：设置写入失败（空间不足 / 不可用）只记日志，不打断开关交互 ——
   * 内存态已更新，本次会话仍然一致；崩溃比丢一次设置更伤。
   */
  function persist() {
    try {
      saveSettings(settings.value)
    } catch (e) {
      console.warn('[jiyi] 设置保存失败：', e)
    }
  }

  function set<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    settings.value = { ...settings.value, [key]: value }
    persist()
  }

  /** 授权保存出生数据（记时间，便于用户核对） */
  function grantBirthDataConsent() {
    settings.value = {
      ...settings.value,
      birthDataConsent: true,
      birthDataConsentAt: Date.now()
    }
    persist()
  }

  /** 撤回授权：清标记与时间（已有记录不动 —— 要不要删由用户在记录页自己决定） */
  function revokeBirthDataConsent() {
    settings.value = {
      ...settings.value,
      birthDataConsent: false,
      birthDataConsentAt: null
    }
    persist()
  }

  function reset() {
    settings.value = { ...DEFAULT_SETTINGS }
    persist()
  }

  return {
    settings,
    trueSolarTime,
    lowEnd,
    reduceMotion,
    theme,
    webFont,
    birthDataConsent,
    set,
    grantBirthDataConsent,
    revokeBirthDataConsent,
    reset
  }
})
