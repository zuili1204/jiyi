import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAiSession } from '@/engine/ai/client'
import type { AiConfig } from '@/platform/storage'
import type { ReadingRecord } from '@/types/reading'

/**
 * BYOK 客户端（JY-07 §7 / §9）
 *
 * 覆盖验收：
 * - §9-2：关闭敏感开关时出生数据不出现在请求体中；
 * - §9-3：后检命中禁词保留原文并标记 flagged（client 侧）；
 * - §9-4：四类网络错误经 client 构造用例分别诊断；
 * - §9-5：取消请求后迟到结果不渲染（自增 token 作废）；
 * - §8：错误信息永不携带密钥。
 */

const CONFIG: AiConfig = {
  enabled: true,
  provider: 'custom',
  baseUrl: 'https://api.example.com/v1/',
  model: 'test-model',
  apiKey: 'sk-test-key',
  temperature: 0.5,
  allowSensitive: false,
  acknowledgedAt: 1
}

const RECORD: ReadingRecord = {
  id: 'r1',
  kind: 'lots',
  method: 'sign',
  schemaVersion: 1,
  dataVersion: 1,
  createdAt: 0,
  input: { kind: 'guanyin', question: '问出行' },
  result: {},
  interpretation: {
    title: '第十二签',
    summary: '签诗',
    blocks: [{ key: 'poem', label: '签诗', text: '甲乙丙丁' }],
    basis: { index: 12 }
  },
  piiFields: []
}

function okResponse(content: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] })
  }
}

function statusResponse(status: number) {
  return { ok: false, status, json: async () => ({}) }
}

type Handler = (input: RequestInfo | URL, init?: RequestInit) => Promise<unknown>

function stubFetch(handler: Handler) {
  const fn = vi.fn((input: RequestInfo | URL, init?: RequestInit) => handler(input, init))
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('请求体与响应解析', () => {
  it('POST 到 baseUrl + /chat/completions，Bearer 鉴权，密钥不进请求体', async () => {
    const fetchMock = stubFetch(async () => okResponse('白话内容'))
    const session = createAiSession(CONFIG)
    const res = await session.run(RECORD)

    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    expect(res.ai.text).toBe('白话内容')
    expect(res.ai.model).toBe('test-model')
    expect(typeof res.ai.createdAt).toBe('number')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.example.com/v1/chat/completions')
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer sk-test-key')

    const body = JSON.parse(String(init.body)) as {
      model: string
      temperature: number
      stream: boolean
      messages: { role: string; content: string }[]
    }
    expect(body.model).toBe('test-model')
    expect(body.temperature).toBe(0.5)
    expect(body.stream).toBe(false)
    expect(body.messages[0].role).toBe('system')
    expect(body.messages[1].role).toBe('user')
    expect(body.messages[1].content).toContain('【结果数据】')
    expect(body.messages[1].content).toContain('第十二签')
    // 密钥只出现在 Authorization 头，不进请求体
    expect(String(init.body)).not.toContain('sk-test-key')
  })

  it('验收 2：关闭敏感开关时，出生数据不出现在请求体中', async () => {
    const fetchMock = stubFetch(async () => okResponse('好'))
    const record: ReadingRecord = {
      ...RECORD,
      kind: 'bazi',
      method: 'sizhu',
      input: {
        at: { year: 1990, month: 1, day: 1, hour: 8, minute: 0 },
        place: '北京市',
        gender: 'male',
        question: '问事业'
      }
    }
    const session = createAiSession(CONFIG, { timeoutMs: 500 })
    await session.run(record)

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = String(init.body)
    expect(body).not.toContain('北京市')
    expect(body).not.toContain('1990')
    expect(body).not.toContain('male')
  })

  it('验收 3：后检命中禁词 → 保留原文并标记 flagged', async () => {
    const text = '这波行情建议买入，一定会涨停。'
    stubFetch(async () => okResponse(text))
    const session = createAiSession(CONFIG)
    const res = await session.run(RECORD)
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    expect(res.ai.flagged).toContain('invest')
    expect(res.ai.flagged).toContain('absolute')
    expect(res.ai.text).toBe(text) // 原文原样，不改写
  })

  it('未配置密钥：直接报错，不发起请求', async () => {
    const fetchMock = stubFetch(async () => okResponse('x'))
    const session = createAiSession({ ...CONFIG, apiKey: '' })
    const res = await session.run(RECORD)
    expect(res.status).toBe('error')
    if (res.status !== 'error') return
    expect(res.title).toContain('密钥')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('模型返回为空：明确报错', async () => {
    stubFetch(async () => okResponse(''))
    const session = createAiSession(CONFIG)
    const res = await session.run(RECORD)
    expect(res.status).toBe('error')
    if (res.status !== 'error') return
    expect(res.title).toContain('返回为空')
  })
})

describe('取消语义（验收 5：迟到结果不渲染）', () => {
  it('先取消、后 resolve：结果作废为 cancelled', async () => {
    let resolveFetch: (v: unknown) => void = () => {}
    stubFetch(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve
        })
    )
    const session = createAiSession(CONFIG)
    const pending = session.run(RECORD)
    session.cancel()
    resolveFetch(okResponse('迟到的结果'))
    const res = await pending
    expect(res).toEqual({ status: 'cancelled' })
  })

  it('用户取消触发 abort：run 以 cancelled 收场', async () => {
    let capturedSignal: AbortSignal | null = null
    stubFetch(async (_input, init) => {
      capturedSignal = (init?.signal as AbortSignal) ?? null
      return new Promise<never>(() => {
        const e = new Error('Aborted')
        e.name = 'AbortError'
        if (capturedSignal) capturedSignal.addEventListener('abort', () => Promise.reject(e), { once: true })
      }).catch(() => undefined)
    })
    // 上面 catch 会吞掉拒绝，改为直接挂起并由 abort 拒绝：
    stubFetch((_input, init) => {
      const signal = (init?.signal as AbortSignal) ?? null
      return new Promise<never>((_, rej) => {
        const e = new Error('Aborted')
        e.name = 'AbortError'
        if (signal) signal.addEventListener('abort', () => rej(e), { once: true })
      })
    })
    const session = createAiSession(CONFIG)
    const pending = session.run(RECORD)
    session.cancel()
    const res = await pending
    expect(res).toEqual({ status: 'cancelled' })
  })
})

describe('四类网络错误经 client 分别诊断（验收 4）', () => {
  it('offline：navigator.onLine=false 时直接判离线', async () => {
    stubFetch(async () => {
      throw new Error('Failed to fetch')
    })
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
    const session = createAiSession(CONFIG, { timeoutMs: 500 })
    const res = await session.run(RECORD)
    expect(res.status).toBe('error')
    if (res.status !== 'error') return
    expect(res.category).toBe('offline')
  })

  it('cors：请求被拒但 no-cors 探测可达', async () => {
    let calls = 0
    stubFetch(async () => {
      if (calls++ === 0) throw new Error('Failed to fetch')
      return { ok: true, status: 200, json: async () => ({}) } // 探测（no-cors HEAD）可达
    })
    const session = createAiSession(CONFIG, { timeoutMs: 500 })
    const res = await session.run(RECORD)
    expect(res.status).toBe('error')
    if (res.status !== 'error') return
    expect(res.category).toBe('cors')
    expect(res.title).toContain('CORS')
  })

  it('network：请求与探测均失败', async () => {
    stubFetch(async () => {
      throw new Error('Failed to fetch')
    })
    const session = createAiSession(CONFIG, { timeoutMs: 500 })
    const res = await session.run(RECORD)
    expect(res.status).toBe('error')
    if (res.status !== 'error') return
    expect(res.category).toBe('network')
  })

  it('timeout：超时中断并给出超时诊断', async () => {
    stubFetch((_input, init) => {
      const signal = (init?.signal as AbortSignal) ?? null
      return new Promise<never>((_, rej) => {
        const e = new Error('Aborted')
        e.name = 'AbortError'
        if (signal) signal.addEventListener('abort', () => rej(e), { once: true })
      })
    })
    const session = createAiSession(CONFIG, { timeoutMs: 20 })
    const res = await session.run(RECORD)
    expect(res.status).toBe('error')
    if (res.status !== 'error') return
    expect(res.category).toBe('timeout')
    expect(res.title).toContain('超时')
  })

  it('HTTP 401：密钥被拒的细分提示', async () => {
    stubFetch(async () => statusResponse(401))
    const session = createAiSession(CONFIG, { timeoutMs: 500 })
    const res = await session.run(RECORD)
    expect(res.status).toBe('error')
    if (res.status !== 'error') return
    expect(res.category).toBe('http')
    expect(res.title).toContain('密钥')
  })
})

describe('密钥安全（JY-07 §8）', () => {
  it('任何错误结果都不得携带密钥（含第三方错误消息里的同名串）', async () => {
    stubFetch(async () => {
      throw new Error('connect failed near sk-test-key ... leaked sk-secret-xyz')
    })
    const session = createAiSession(CONFIG, { timeoutMs: 500 })
    const res = await session.run(RECORD)
    const serialized = JSON.stringify(res)
    expect(serialized).not.toContain('sk-test-key')
    expect(serialized).not.toContain('sk-secret-xyz')
    expect(res.status).toBe('error')
  })
})
