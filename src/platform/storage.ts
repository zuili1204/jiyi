import {
  migrateRecord,
  RECORD_LIMIT,
  SCHEMA_VERSION,
  type ReadingRecord
} from '@/types/reading'

// 供 store / 测试复用的常量（来自类型模块）
export { migrateRecord, RECORD_LIMIT, SCHEMA_VERSION }

/**
 * 存储层（JY-03 §7 唯一权威源）
 *
 * key 命名空间：一律 jiyi.*
 * 纪律：达到上限提示导出并手动清理，**不静默删除**。
 */

export const STORAGE_KEYS = {
  records: 'jiyi.records.v1',
  settings: 'jiyi.settings.v1',
  ai: 'jiyi.ai.v1',
  contentMeta: 'jiyi.content.meta.v1',
  onboarding: 'jiyi.onboarding.v1'
} as const

/** 存储后端：便于测试注入内存实现 */
export interface StorageBackend {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const memory = new Map<string, string>()

export const memoryBackend: StorageBackend = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => void memory.set(k, v),
  removeItem: (k) => void memory.delete(k)
}

function defaultBackend(): StorageBackend {
  try {
    if (typeof localStorage !== 'undefined') {
      const probe = '__jiyi_probe__'
      localStorage.setItem(probe, '1')
      localStorage.removeItem(probe)
      return localStorage
    }
  } catch {
    // 隐私模式 / 无 DOM：降级到内存
  }
  return memoryBackend
}

let backend: StorageBackend = defaultBackend()

/** 仅供测试与初始化：切换后端 */
export function __setStorageBackend(b: StorageBackend): void {
  backend = b
}

function readJson<T>(key: string, fallback: T): T {
  const raw = backend.getItem(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    // 数据损坏：不静默吞掉，回退默认值并记录
    console.warn(`[jiyi] ${key} 解析失败，回退默认值`)
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  backend.setItem(key, JSON.stringify(value))
}

// ---------------------------------------------------------------- 记录

export function loadRecords(): ReadingRecord[] {
  const raw = readJson<unknown>(STORAGE_KEYS.records, [])
  if (!Array.isArray(raw)) return []
  const out: ReadingRecord[] = []
  for (const item of raw) {
    try {
      out.push(migrateRecord(item as Record<string, any>))
    } catch (e) {
      // 单条损坏不拖垮整体，但必须可见（不静默）
      console.warn(`[jiyi] 跳过损坏记录：${(e as Error).message}`)
    }
  }
  return out
}

export function saveRecords(records: ReadingRecord[]): void {
  writeJson(STORAGE_KEYS.records, records)
}

export interface AppendResult {
  ok: boolean
  reason?: 'LIMIT_REACHED'
  limit: number
}

/** 追加记录；达到上限时返回 LIMIT_REACHED，由调用方提示导出 */
export function appendRecord(record: ReadingRecord): AppendResult {
  const records = loadRecords()
  if (records.length >= RECORD_LIMIT) {
    return { ok: false, reason: 'LIMIT_REACHED', limit: RECORD_LIMIT }
  }
  records.push(record)
  saveRecords(records)
  return { ok: true, limit: RECORD_LIMIT }
}

export function deleteRecord(id: string): void {
  saveRecords(loadRecords().filter((r) => r.id !== id))
}

export function clearRecords(): void {
  saveRecords([])
}

export function isNearLimit(): boolean {
  return loadRecords().length >= RECORD_LIMIT
}

// ---------------------------------------------------------------- 设置 / 其它

export interface AppSettings {
  theme: 'dark' | 'light'
  reduceMotion: boolean
  lowEnd: boolean
  /** 真太阳时开关（默认关，JY-02 §3.1） */
  trueSolarTime: boolean
  sound: boolean
  /**
   * 联网标题字体（默认关）：开启后会向第三方字体服务发起请求。
   * 涉及隐私与离线可用性，故必须由用户显式打开，且失败时静默回退系统字体。
   */
  webFont: boolean
  /**
   * **出生数据（PII）保存授权**（J4 / Y4-04）。默认 false。
   * 未授权时，命理品类（八字 / 紫微）**不得向存储写入任何出生数据** ——
   * 可以照常排盘给人看，但一律不落库。
   */
  birthDataConsent: boolean
  /** 授权时间（可审计，便于用户核对"我什么时候同意的"）；撤回时置 null */
  birthDataConsentAt: number | null
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  reduceMotion: false,
  lowEnd: false,
  trueSolarTime: false,
  sound: false,
  webFont: false,
  birthDataConsent: false,
  birthDataConsentAt: null
}

export function loadSettings(): AppSettings {
  return { ...DEFAULT_SETTINGS, ...readJson<Partial<AppSettings>>(STORAGE_KEYS.settings, {}) }
}

export function saveSettings(s: AppSettings): void {
  writeJson(STORAGE_KEYS.settings, s)
}

export interface ContentMeta {
  version: number
  syncedAt?: number
}

export function loadContentMeta(): ContentMeta {
  return readJson<ContentMeta>(STORAGE_KEYS.contentMeta, { version: 0 })
}

export function saveContentMeta(meta: ContentMeta): void {
  writeJson(STORAGE_KEYS.contentMeta, meta)
}

/** 数据版本：产文即快照（JY-03 §4.2） */
export function currentDataVersion(): number {
  return loadContentMeta().version
}

export const STORAGE_SCHEMA_VERSION = SCHEMA_VERSION

// ---------------------------------------------------------------- AI 深度解读（BYOK，JY-07 §3 / §8 唯一权威源）

/**
 * AI 配置。key `jiyi.ai.v1` **独立存储**，导出备份默认排除（exportImport 只打包 records）。
 *
 * 纪律（JY-07 §8）：
 * - 密钥明文存本机 —— 设置页必须明示该风险；
 * - 日志中永不输出密钥（JY-04 §7 敏感信息扫描项）；
 * - 未经知情弹窗确认（acknowledgedAt 为 null）不得处于启用态。
 */
export interface AiConfig {
  enabled: boolean
  /** 服务商预设 id（data/ai-providers.ts），'custom' 为自定义 OpenAI 兼容端点 */
  provider: string
  baseUrl: string
  /** 模型名由用户自由填写：不预设 chat / flash / pro 等档位（JY-07 §7） */
  model: string
  apiKey: string
  temperature: number
  /** 允许发送敏感信息（PII）：默认关；关闭时出生数据一律不进请求体（JY-07 §9 验收 2） */
  allowSensitive: boolean
  /** 知情弹窗确认时间；null = 尚未确认 */
  acknowledgedAt: number | null
}

export const DEFAULT_AI_CONFIG: AiConfig = {
  enabled: false,
  provider: 'deepseek',
  baseUrl: 'https://api.deepseek.com',
  model: '',
  apiKey: '',
  temperature: 0.7,
  allowSensitive: false,
  acknowledgedAt: null
}

export function loadAiConfig(): AiConfig {
  const raw = readJson<Partial<AiConfig>>(STORAGE_KEYS.ai, {})
  const cfg: AiConfig = {
    ...DEFAULT_AI_CONFIG,
    ...raw,
    apiKey: typeof raw.apiKey === 'string' ? raw.apiKey : ''
  }
  // 未经知情确认不得处于启用态（把手工改存储的路也堵上）
  if (cfg.acknowledgedAt == null) cfg.enabled = false
  return cfg
}

export function saveAiConfig(c: AiConfig): void {
  writeJson(STORAGE_KEYS.ai, c)
}

/** 一键清除：整包移除（密钥不留痕） */
export function clearAiConfig(): void {
  backend.removeItem(STORAGE_KEYS.ai)
}

// ---------------------------------------------------------------- 首启引导（JY-14 §3.1 C 方案）

export interface OnboardingState {
  /** 是否已看过引导（本次跳过也算看过） */
  tookTutorial: boolean
  /** 用户选择「不再提示」时置为 true，此后不再自动弹出，但仍可经教程页查看 */
  tutorialDismissed: boolean
}

export const DEFAULT_ONBOARDING: OnboardingState = {
  tookTutorial: false,
  tutorialDismissed: false
}

export function loadOnboarding(): OnboardingState {
  return { ...DEFAULT_ONBOARDING, ...readJson<Partial<OnboardingState>>(STORAGE_KEYS.onboarding, {}) }
}

export function saveOnboarding(s: OnboardingState): void {
  writeJson(STORAGE_KEYS.onboarding, s)
}
