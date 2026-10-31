import { migrateRecord, SCHEMA_VERSION, type ReadingRecord } from '@/types/reading'

/**
 * 导出 / 导入（JY-03 §7.3 / §7.4）
 *
 * 硬约束：
 * - 导出默认脱敏（剔除 piiFields 登记的路径）
 * - jiyi.ai.v1（密钥）永不导出
 * - 高于当前 schemaVersion 的备份拒绝导入（不降级解析）
 */

export const EXPORT_APP_ID = 'jiyi'
export const EXPORT_FORMAT_VERSION = 1

export interface ExportBundle {
  app: string
  formatVersion: number
  schemaVersion: number
  exportedAt: number
  /** 本次导出被剔除的 PII 字段路径 */
  redactedFields: string[]
  /** 是否包含完整出生数据（需显式同意） */
  includesPii: boolean
  records: ReadingRecord[]
}

function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<any>((acc, k) => (acc == null ? undefined : acc[k]), obj)
}

function unsetByPath(obj: any, path: string): void {
  const keys = path.split('.')
  let cur = obj
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur[keys[i]] == null) return
    cur = cur[keys[i]]
  }
  if (cur && typeof cur === 'object') delete cur[keys[keys.length - 1]]
}

/** 深拷贝 + 按 piiFields 剔除 */
export function redactRecord(r: ReadingRecord): { record: ReadingRecord; removed: string[] } {
  const clone = JSON.parse(JSON.stringify(r)) as ReadingRecord
  const removed: string[] = []
  for (const path of r.piiFields ?? []) {
    if (getByPath(clone.input, path) !== undefined) {
      unsetByPath(clone.input, path)
      removed.push(`input.${path}`)
    }
  }
  return { record: clone, removed }
}

export function buildExport(
  records: ReadingRecord[],
  opts: { includePii?: boolean } = {}
): ExportBundle {
  const includePii = opts.includePii === true
  const redactedFields = new Set<string>()
  const out: ReadingRecord[] = records.map((r) => {
    if (includePii) return r
    const { record, removed } = redactRecord(r)
    removed.forEach((p) => redactedFields.add(p))
    return record
  })

  return {
    app: EXPORT_APP_ID,
    formatVersion: EXPORT_FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: Date.now(),
    redactedFields: [...redactedFields],
    includesPii: includePii,
    records: out
  }
}

export type ImportMode = 'skip' | 'overwrite' | 'keepBoth'

export interface ImportReport {
  imported: number
  skipped: number
  failed: number
  errors: string[]
}

export function parseImportBundle(text: string): ExportBundle {
  const data = JSON.parse(text) as Partial<ExportBundle>
  if (data?.app !== EXPORT_APP_ID) throw new Error('不是本应用的备份文件')
  if (!Array.isArray(data.records)) throw new Error('备份文件缺少 records')
  if (typeof data.schemaVersion !== 'number') throw new Error('备份文件缺少 schemaVersion')
  if (data.schemaVersion > SCHEMA_VERSION) {
    throw new Error(
      `备份来自更新版本（schemaVersion=${data.schemaVersion} > ${SCHEMA_VERSION}），请升级应用后再导入`
    )
  }
  return data as ExportBundle
}

export function mergeRecords(
  existing: ReadingRecord[],
  incoming: ReadingRecord[],
  mode: ImportMode = 'keepBoth'
): { records: ReadingRecord[]; report: ImportReport } {
  const byId = new Map(existing.map((r) => [r.id, r]))
  const report: ImportReport = { imported: 0, skipped: 0, failed: 0, errors: [] }

  for (const raw of incoming) {
    try {
      const rec = migrateRecord(raw as unknown as Record<string, any>)
      if (byId.has(rec.id)) {
        if (mode === 'skip') {
          report.skipped++
          continue
        }
        if (mode === 'keepBoth') {
          rec.id = `${rec.id}-${rec.createdAt}` // 保证唯一
        }
      }
      byId.set(rec.id, rec)
      report.imported++
    } catch (e) {
      report.failed++
      report.errors.push((e as Error).message)
    }
  }

  return { records: [...byId.values()], report }
}
