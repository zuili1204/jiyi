import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { AiInterpretation, ReadingRecord } from '@/types/reading'
import {
  appendRecord,
  clearRecords,
  deleteRecord,
  loadRecords,
  RECORD_LIMIT,
  saveRecords
} from '@/platform/storage'
import {
  buildExport,
  mergeRecords,
  parseImportBundle,
  type ImportMode,
  type ImportReport
} from '@/platform/exportImport'

/**
 * 记录 store（JY-03 §10）
 *
 * 纪律：达上限提示导出并手动清理，不静默删除。
 */
export const useRecordsStore = defineStore('records', () => {
  const records = ref<ReadingRecord[]>(loadRecords())
  const lastError = ref<string | null>(null)
  const lastImport = ref<ImportReport | null>(null)

  const count = computed(() => records.value.length)
  const nearLimit = computed(() => count.value >= RECORD_LIMIT)

  function refresh() {
    records.value = loadRecords()
  }

  function add(record: ReadingRecord): boolean {
    let res
    try {
      res = appendRecord(record)
    } catch {
      // 本机存储写入失败（空间不足 / 不可用）：不崩溃，明确告知，不打断用户
      lastError.value = '保存失败：本机存储空间不足或不可用，请先导出备份并清理'
      return false
    }
    if (!res.ok) {
      lastError.value = `记录已达上限 ${res.limit} 条，请先导出备份再清理`
      return false
    }
    lastError.value = null
    refresh()
    return true
  }

  function remove(id: string) {
    deleteRecord(id)
    refresh()
  }

  /**
   * AI 解读结果落库（JY-07 §6：原文原样保存，flagged 仅作标记）。
   * 不存在该 id 时静默返回（页面此时已无停留价值，调用方不会渲染）。
   * 存储写入失败返回 false（调用方提示），不向上抛。
   */
  function setAi(id: string, ai: AiInterpretation): boolean {
    const recs = loadRecords()
    const i = recs.findIndex((r) => r.id === id)
    if (i < 0) return false
    recs[i] = { ...recs[i], ai }
    try {
      saveRecords(recs)
    } catch {
      console.warn('[jiyi] AI 解读结果保存失败（本机存储不可用）')
      return false
    }
    refresh()
    return true
  }

  function clear() {
    clearRecords()
    refresh()
  }

  function byKind(kind: string) {
    return records.value.filter((r) => r.kind === kind)
  }

  /** 按 id 取单条记录（详情页用）；不存在返回 undefined —— 由页面决定空态，不在此处兜底造假 */
  function byId(id: string): ReadingRecord | undefined {
    return records.value.find((r) => r.id === id)
  }

  function search(keyword: string) {
    const k = keyword.trim().toLowerCase()
    if (!k) return records.value
    return records.value.filter((r) => {
      const hay = [
        r.method,
        r.interpretation.title,
        r.interpretation.summary,
        String(r.input?.question ?? '')
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(k)
    })
  }

  /** 导出（默认脱敏） */
  function exportJson(opts: { includePii?: boolean } = {}) {
    return JSON.stringify(buildExport(records.value, opts), null, 2)
  }

  /** 导入（合并策略由用户选择），解析失败时抛出并由调用方提示 */
  function importJson(text: string, mode: ImportMode = 'keepBoth'): ImportReport {
    const bundle = parseImportBundle(text)
    const { records: merged, report } = mergeRecords(records.value, bundle.records, mode)
    try {
      saveRecords(merged)
    } catch {
      // 存储写入失败的原生异常是英文（QuotaExceeded 等）：转成可理解的提示再抛
      throw new Error('本机存储写入失败，导入未能保存')
    }
    lastImport.value = report
    refresh()
    return report
  }

  return {
    records,
    count,
    nearLimit,
    lastError,
    lastImport,
    refresh,
    add,
    remove,
    setAi,
    clear,
    byKind,
    byId,
    search,
    exportJson,
    importJson
  }
})
