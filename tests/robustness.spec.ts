import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { friendlyMessage, GENERIC_ERROR_TEXT } from '@/platform/errors'
import { useRecordsStore } from '@/stores/records'
import { useSettingsStore } from '@/stores/settings'
import {
  __setStorageBackend,
  memoryBackend,
  clearRecords,
  clearAiConfig,
  type StorageBackend
} from '@/platform/storage'
import { buildExport } from '@/platform/exportImport'
import type { ReadingRecord, AiInterpretation } from '@/types/reading'

/**
 * 健壮性兜底（错误转用户可读文案 + 存储写入失败不崩溃）
 *
 * 覆盖点：
 * - friendlyMessage：引擎错误 → 可执行建议；映射不上 → 兜底文案
 * - records.add：存储写入失败返回 false 并给出可理解 lastError，不向上抛
 * - records.setAi：存储写入失败返回 false
 * - records.importJson：存储写入失败抛可理解中文（历史页 catch 后直接展示）
 * - settings.set：存储写入失败不打断交互（内存态仍更新）
 */

function sampleRecord(id: string): ReadingRecord {
  return {
    id,
    kind: 'lots',
    method: 'coin',
    schemaVersion: 1,
    dataVersion: 0,
    createdAt: Date.now(),
    input: {},
    result: { face: 'up' },
    interpretation: { title: 't', summary: 's', blocks: [] },
    piiFields: []
  }
}

/** 只在写入时抛错的存储后端（模拟空间不足 / 隐私模式限制） */
function throwingBackend(): StorageBackend {
  return {
    getItem: (k) => memoryBackend.getItem(k),
    setItem: () => {
      throw new Error('QuotaExceededError')
    },
    removeItem: (k) => memoryBackend.removeItem(k)
  }
}

describe('friendlyMessage：引擎错误转用户可读文案', () => {
  it('数字起卦输入错误给填写指引', () => {
    expect(friendlyMessage(new Error('数字起卦需要两个有效数字'))).toBe('请填写两个有效数字后再起卦')
    expect(friendlyMessage(new Error('数字起卦需要 a / b'))).toBe('请填写两个有效数字后再起卦')
  })

  it('字数起卦缺文本给填写指引，缺时辰归到时刻类', () => {
    expect(friendlyMessage(new Error('字数起卦需要 text'))).toBe('请填写要占算的文字')
    expect(friendlyMessage(new Error('字数起卦需要非空文本'))).toBe('请填写要占算的文字')
    expect(friendlyMessage(new Error('字数起卦需要时辰'))).toBe('问占时刻有误，请确认后重试')
  })

  it('历法越界类给调整日期的指引', () => {
    expect(friendlyMessage(new Error('年份必须是整数，收到 99999'))).toBe(
      '所选日期或时刻超出可推算范围，请调整后重试'
    )
    expect(friendlyMessage(new Error('无法解析年支：无效文本'))).toBe(
      '所选日期或时刻超出可推算范围，请调整后重试'
    )
    expect(friendlyMessage(new Error('经度非法：999'))).toBe('出生地经度有误，请重新选择')
  })

  it('映射不上的错误走兜底文案，不透出内部术语', () => {
    expect(friendlyMessage(new Error('卦「乾」不在八宫表中（数据缺失，拒绝猜测）'))).toBe(
      GENERIC_ERROR_TEXT
    )
    expect(friendlyMessage('boom')).toBe(GENERIC_ERROR_TEXT)
    expect(friendlyMessage(new Error('x'), '起卦未完成，请稍后再试')).toBe('起卦未完成，请稍后再试')
  })
})

describe('记录 store：存储写入失败不崩溃', () => {
  beforeEach(() => {
    __setStorageBackend(memoryBackend)
    clearRecords()
    clearAiConfig()
    setActivePinia(createPinia())
  })

  it('add 写入失败 → 返回 false 且 lastError 可理解，不抛出', () => {
    const store = useRecordsStore()
    __setStorageBackend(throwingBackend())
    expect(() => store.add(sampleRecord('a'))).not.toThrow()
    expect(store.add(sampleRecord('b'))).toBe(false)
    expect(store.lastError).toBe('保存失败：本机存储空间不足或不可用，请先导出备份并清理')
  })

  it('setAi 写入失败 → 返回 false；成功 → true 且落库', () => {
    const store = useRecordsStore()
    store.add(sampleRecord('a'))
    const ai: AiInterpretation = { text: '白话', model: 'm', createdAt: 1 }
    expect(store.setAi('missing', ai)).toBe(false)

    __setStorageBackend(throwingBackend())
    expect(store.setAi('a', ai)).toBe(false)

    __setStorageBackend(memoryBackend)
    expect(store.setAi('a', ai)).toBe(true)
    expect(store.byId('a')?.ai?.text).toBe('白话')
  })

  it('importJson 写入失败 → 抛可理解中文（历史页直接展示）', () => {
    const store = useRecordsStore()
    store.add(sampleRecord('local'))
    const bundle = JSON.stringify(buildExport([sampleRecord('r1')]))

    __setStorageBackend(throwingBackend())
    expect(() => store.importJson(bundle)).toThrow('本机存储写入失败，导入未能保存')
  })

  it('settings.set 写入失败 → 不打断交互，内存态仍更新', () => {
    const settings = useSettingsStore()
    __setStorageBackend(throwingBackend())
    expect(() => settings.set('theme', 'light')).not.toThrow()
    expect(settings.theme).toBe('light')
  })
})
