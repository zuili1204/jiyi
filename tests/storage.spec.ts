import { describe, it, expect, beforeEach } from 'vitest'
import { memoryBackend, __setStorageBackend, loadRecords, appendRecord, clearRecords, RECORD_LIMIT, deleteRecord, migrateRecord } from '@/platform/storage'
import type { ReadingRecord } from '@/types/reading'

function sampleRecord(id: string, pii: boolean): ReadingRecord {
  return {
    id,
    kind: 'lots',
    method: 'coin',
    schemaVersion: 1,
    dataVersion: 0,
    createdAt: Date.now(),
    input: pii ? { birth: '2000-01-01' } : {},
    result: { face: 'up' },
    interpretation: { title: 't', summary: 's', blocks: [] },
    piiFields: pii ? ['birth'] : []
  }
}

describe('存储层', () => {
  beforeEach(() => {
    __setStorageBackend(memoryBackend)
    clearRecords()
  })

  it('追加与读取', () => {
    expect(appendRecord(sampleRecord('a', false)).ok).toBe(true)
    const all = loadRecords()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe('a')
  })

  it('达到上限拒绝追加', () => {
    for (let i = 0; i < RECORD_LIMIT; i++) appendRecord(sampleRecord(`r${i}`, false))
    const res = appendRecord(sampleRecord('overflow', false))
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('LIMIT_REACHED')
    expect(loadRecords()).toHaveLength(RECORD_LIMIT)
  })

  it('删除记录', () => {
    appendRecord(sampleRecord('a', false))
    appendRecord(sampleRecord('b', false))
    deleteRecord('a')
    expect(loadRecords().map((r) => r.id)).toEqual(['b'])
  })

  it('损坏记录被跳过但不拖垮整体', () => {
    memoryBackend.setItem(
      'jiyi.records.v1',
      JSON.stringify([sampleRecord('a', false), { broken: true } as any])
    )
    const all = loadRecords()
    // 损坏项被跳过：有效项仍在
    expect(all.some((r) => r.id === 'a')).toBe(true)
    expect(all.every((r) => r.id !== undefined)).toBe(true)
  })
})

describe('迁移', () => {
  it('同版本直接通过', () => {
    const r = migrateRecord({ id: 'x', kind: 'lots', method: 'coin', schemaVersion: 1 } as any)
    expect(r.schemaVersion).toBe(1)
  })

  it('高于当前版本拒绝', () => {
    expect(() => migrateRecord({ schemaVersion: 999 } as any)).toThrow()
  })

  it('缺失版本号拒绝', () => {
    expect(() => migrateRecord({} as any)).toThrow()
  })
})
