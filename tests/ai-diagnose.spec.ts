import { describe, expect, it } from 'vitest'
import {
  diagnoseFetchFailure,
  diagnoseHttpStatus,
  diagnoseTimeout
} from '@/engine/ai/diagnose'

/**
 * 错误分层诊断（JY-07 §7 / §9-4）：四类网络错误分别诊断（构造用例）
 * offline / timeout / cors / network，另对 HTTP 状态细分。
 */

describe('四类网络错误分别诊断', () => {
  it('无网络 → offline，并说明离线功能不受影响', () => {
    const d = diagnoseFetchFailure({ online: false })
    expect(d.category).toBe('offline')
    expect(d.title).toContain('无网络')
    expect(d.detail).toContain('不受影响')
  })

  it('探测可达 → cors：地址没问题，是跨域被拒', () => {
    const d = diagnoseFetchFailure({ online: true, probeOk: true })
    expect(d.category).toBe('cors')
    expect(d.title).toContain('CORS')
  })

  it('探测不可达 → network：不可达 / DNS / TLS 三种可能并列提示', () => {
    const d = diagnoseFetchFailure({ online: true, probeOk: false })
    expect(d.category).toBe('network')
    expect(d.detail).toContain('DNS')
    expect(d.detail).toContain('TLS')
  })

  it('超时 → timeout，带明确时长', () => {
    const d = diagnoseTimeout(60_000)
    expect(d.category).toBe('timeout')
    expect(d.title).toContain('超时')
    expect(d.detail).toContain('60')
  })

  it('四类互异且可重试', () => {
    const cats = new Set([
      diagnoseFetchFailure({ online: false }).category,
      diagnoseTimeout(1000).category,
      diagnoseFetchFailure({ online: true, probeOk: true }).category,
      diagnoseFetchFailure({ online: true, probeOk: false }).category
    ])
    expect(cats.size).toBe(4)
  })

  it('缺省探测信息时保守归为 network（不误报跨域）', () => {
    expect(diagnoseFetchFailure({}).category).toBe('network')
  })
})

describe('HTTP 状态细分', () => {
  it('401 / 403 → 密钥问题', () => {
    for (const s of [401, 403]) {
      const d = diagnoseHttpStatus(s)
      expect(d.title).toContain('密钥')
      expect(d.category).toBe('http')
    }
  })

  it('404 → 提示模型名可编辑（JY-07 §7 模型名过期）', () => {
    const d = diagnoseHttpStatus(404)
    expect(d.detail).toContain('模型名')
  })

  it('429 → 限流', () => {
    const d = diagnoseHttpStatus(429)
    expect(d.title).toContain('429')
    expect(d.detail).toContain('限流')
  })

  it('5xx → 服务商错误', () => {
    const d = diagnoseHttpStatus(503)
    expect(d.title).toContain('503')
    expect(d.detail).toContain('服务商')
  })
})
