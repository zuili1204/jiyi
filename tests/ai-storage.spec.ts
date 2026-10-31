import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearAiConfig,
  DEFAULT_AI_CONFIG,
  loadAiConfig,
  saveAiConfig,
  STORAGE_KEYS,
  __setStorageBackend,
  memoryBackend
} from '@/platform/storage'
import { buildExport } from '@/platform/exportImport'
import type { ReadingRecord } from '@/types/reading'

/**
 * AI 配置存储（JY-07 §8 / §9-6）
 *
 * 覆盖验收：
 * - §9-6：导出文件中不含 jiyi.ai.v1（密钥永不导出）；
 * - §8：未经知情确认不得处于启用态；一键清除整包移除。
 */

const RECORD: ReadingRecord = {
  id: 'r1',
  kind: 'lots',
  method: 'sign',
  schemaVersion: 1,
  dataVersion: 1,
  createdAt: 0,
  input: { kind: 'guanyin' },
  result: {},
  interpretation: { title: '第十二签', summary: '签诗', blocks: [] },
  piiFields: []
}

beforeEach(() => {
  __setStorageBackend(memoryBackend)
  clearAiConfig()
})

describe('AiConfig 存储', () => {
  it('默认配置：未启用、未知情、无密钥', () => {
    const cfg = loadAiConfig()
    expect(cfg.enabled).toBe(false)
    expect(cfg.acknowledgedAt).toBeNull()
    expect(cfg.apiKey).toBe('')
    expect(cfg.allowSensitive).toBe(false)
  })

  it('未经知情确认（acknowledgedAt=null）时，即使存储里 enabled=true 也强制关闭', () => {
    saveAiConfig({ ...DEFAULT_AI_CONFIG, enabled: true, apiKey: 'sk-x', acknowledgedAt: null })
    expect(loadAiConfig().enabled).toBe(false)
  })

  it('知情后启用：roundtrip 保留', () => {
    const cfg = { ...DEFAULT_AI_CONFIG, enabled: true, apiKey: 'sk-x', acknowledgedAt: 123 }
    saveAiConfig(cfg)
    const loaded = loadAiConfig()
    expect(loaded.enabled).toBe(true)
    expect(loaded.apiKey).toBe('sk-x')
    expect(loaded.acknowledgedAt).toBe(123)
  })

  it('一键清除：整包移除，回默认值（密钥不留痕）', () => {
    saveAiConfig({ ...DEFAULT_AI_CONFIG, apiKey: 'sk-x', acknowledgedAt: 1 })
    clearAiConfig()
    expect(loadAiConfig()).toEqual(DEFAULT_AI_CONFIG)
    expect(memoryBackend.getItem(STORAGE_KEYS.ai)).toBeNull()
  })
})

describe('验收 6：导出不含 jiyi.ai.v1', () => {
  it('导出包里没有密钥值，也没有该存储键的字样', () => {
    saveAiConfig({
      ...DEFAULT_AI_CONFIG,
      enabled: true,
      apiKey: 'sk-export-secret',
      acknowledgedAt: 1
    })
    const json = buildExport([RECORD], { includePii: true })
    const text = JSON.stringify(json)
    expect(text).not.toContain('sk-export-secret')
    expect(text).not.toContain('jiyi.ai.v1')
    // 记录本体照常导出
    expect(json.records).toHaveLength(1)
  })
})
