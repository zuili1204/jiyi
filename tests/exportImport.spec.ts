import { describe, it, expect } from 'vitest'
import { buildExport, redactRecord, parseImportBundle, mergeRecords, EXPORT_APP_ID } from '@/platform/exportImport'
import type { ReadingRecord } from '@/types/reading'

function rec(id: string, pii?: string): ReadingRecord {
  return {
    id,
    kind: 'lots',
    method: 'coin',
    schemaVersion: 1,
    dataVersion: 0,
    createdAt: 1,
    input: pii ? { birth: pii } : {},
    result: { face: 'up' },
    interpretation: { title: 't', summary: 's', blocks: [] },
    piiFields: pii ? ['birth'] : []
  }
}

describe('导出 / 导入', () => {
  it('默认导出脱敏', () => {
    const bundle = buildExport([rec('a', '2000-01-01'), rec('b')])
    expect(bundle.includesPii).toBe(false)
    expect(bundle.redactedFields).toContain('input.birth')
    expect(JSON.stringify(bundle.records)).not.toContain('2000-01-01')
  })

  it('显式包含 PII 不脱敏', () => {
    const bundle = buildExport([rec('a', '2000-01-01')], { includePii: true })
    expect(bundle.includesPii).toBe(true)
    expect(JSON.stringify(bundle.records)).toContain('2000-01-01')
  })

  it('redactRecord 只剔除登记路径', () => {
    const { record, removed } = redactRecord(rec('a', '2000-01-01'))
    expect(removed).toContain('input.birth')
    expect((record.input as any).birth).toBeUndefined()
  })

  it('导入：拒绝更高 schemaVersion', () => {
    const bad = JSON.stringify({ app: EXPORT_APP_ID, formatVersion: 1, schemaVersion: 99, records: [] })
    expect(() => parseImportBundle(bad)).toThrow()
  })

  it('导入：拒绝非本应用', () => {
    expect(() => parseImportBundle(JSON.stringify({ app: 'other' }))).toThrow()
  })

  it('导入：keepBoth 重名共存', () => {
    const a = rec('dup', 'p1')
    const b = rec('dup', 'p2')
    const { records, report } = mergeRecords([a], [b], 'keepBoth')
    expect(records).toHaveLength(2)
    expect(report.imported).toBe(1)
    expect(report.skipped).toBe(0)
  })

  it('导入：skip 重名跳过', () => {
    const a = rec('dup', 'p1')
    const b = rec('dup', 'p2')
    const { records, report } = mergeRecords([a], [b], 'skip')
    expect(records).toHaveLength(1)
    expect(report.skipped).toBe(1)
  })
})
