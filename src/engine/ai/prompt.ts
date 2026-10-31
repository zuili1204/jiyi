import { COMPLIANCE_WORDS, FAMILY_BY_KIND } from '@/engine/compliance'
import type { DivinationKind } from '@/engine/types'
import type { ReadingRecord } from '@/types/reading'
import promptSpec from '@/data/ai-prompt.json'

/**
 * Prompt 组装（JY-07 §5 唯一权威源）
 *
 * 纪律：
 * - **AI 只做白话转述**（红线 R8）：输入给模型的只有引擎已产出的结构化结果；
 * - PII 规则：出生数据默认不进 prompt，仅 allowSensitive 开启后随请求发送（§9 验收 2）；
 * - 禁用词必须**原样列举**进 prompt（否则模型不会避开）——运行时从内容闸词表注入，
 *   `ai-prompt.json` 本身不落禁词，因此不需要豁免内容闸；
 * - `ai-prompt.json` 按结构校验（JY-04 §3.4 自指豁免：role / output / labels / stance / kind 分支），
 *   校验用例见 `tests/ai-prompt.spec.ts`。
 */

export interface AiPromptKindSpec {
  intro: string
  fields: Record<string, string>
  forbidden: string[]
}

export interface AiPromptSpec {
  version: number
  role: string
  stance: string
  output: { format: string; sections: string[] }
  labels: string[]
  kinds: Record<DivinationKind, AiPromptKindSpec>
}

export const AI_PROMPT_SPEC = promptSpec as unknown as AiPromptSpec

/** 该品类启用的内容闸词族的全量禁词（原样进 prompt） */
export function bannedWordsFor(kind: DivinationKind): string[] {
  const enabled = new Set(FAMILY_BY_KIND[kind] ?? [])
  const out: string[] = []
  for (const rule of COMPLIANCE_WORDS) {
    if (enabled.has(rule.family)) out.push(...rule.words)
  }
  return out
}

export interface AiPromptResult {
  system: string
  user: string
}

export interface AiPromptOptions {
  /** 是否允许发送敏感信息（出生数据）。默认 false：任何情况下 PII 都不进 prompt */
  allowSensitive?: boolean
}

/** 出生数据在 input 中的键（bazi / ziwei；JY-07 §5 PII 规则） */
const SENSITIVE_INPUT_KEYS = ['at', 'place', 'gender'] as const

/** 依据值的紧凑格式化：人是模型，给它干净 JSON / 干支文本，不糊对象原型 */
function compactBasisValue(key: string, v: unknown): string {
  if (key === 'pillars' && v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return (['year', 'month', 'day', 'time'] as const)
      .map((k) => {
        const g = o[k] as Record<string, unknown> | undefined
        const t = g?.['text']
        return typeof t === 'string' ? t : '—'
      })
      .join(' ')
  }
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

/** 按品类 spec 挑选结果要素：只给 spec.fields 登记过的键，宁缺勿滥 */
function digestOf(record: ReadingRecord): string[] {
  const kind = record.kind
  const spec = AI_PROMPT_SPEC.kinds[kind]
  const basis = (record.interpretation?.basis ?? record.basis ?? {}) as Record<string, unknown>
  const lines: string[] = []

  for (const [key, label] of Object.entries(spec.fields)) {
    if (key === 'title') {
      const t = record.interpretation?.title
      if (t) lines.push(`${label}：${t}`)
      continue
    }
    const v = basis[key]
    if (v === undefined || v === null || v === '') continue
    lines.push(`${label}：${compactBasisValue(key, v)}`)
  }
  // 解读分块（签诗 / 解曰 / 爻辞 / 白话条目等）：原文与既产出的解读全量给模型
  for (const b of record.interpretation?.blocks ?? []) {
    if (b.text) lines.push(`${b.label}：${b.text}`)
  }
  return lines
}

/** 敏感信息段：仅显式同意后拼接；关闭时返回空数组且不留下任何 PII */
function sensitiveLines(record: ReadingRecord, allowSensitive: boolean): string[] {
  if (!allowSensitive) return []
  const input = (record.input ?? {}) as Record<string, unknown>
  const out: string[] = []
  for (const k of SENSITIVE_INPUT_KEYS) {
    const v = input[k]
    if (v === undefined || v === null || v === '') continue
    out.push(`${k}：${JSON.stringify(v)}`)
  }
  return out.length ? ['【出生数据（用户已明确同意发送）】', ...out] : []
}

export function buildAiPrompt(record: ReadingRecord, opts: AiPromptOptions = {}): AiPromptResult {
  const allowSensitive = opts.allowSensitive === true
  const spec = AI_PROMPT_SPEC
  const kindSpec = spec.kinds[record.kind]

  const userParts: string[] = [kindSpec.intro, '【结果数据】', ...digestOf(record)]
  const sensitive = sensitiveLines(record, allowSensitive)
  userParts.push(...sensitive)

  const question =
    typeof record.input?.['question'] === 'string'
      ? (record.input['question'] as string).trim()
      : typeof record.input?.['note'] === 'string'
        ? (record.input['note'] as string).trim()
        : ''
  if (question) userParts.push(`【所问】${question}`)

  const forbidden = [
    ...spec.stance.split('；'),
    ...kindSpec.forbidden,
    ...(sensitive.length
      ? []
      : ['未获敏感信息授权：请求中不含出生数据，即使要素缺失也不要询问或反推']),
    `禁用词（以下词语一个都不许出现在输出中）：${bannedWordsFor(record.kind).join('、')}`
  ]
  userParts.push('【禁止】', ...forbidden.map((f) => `- ${f}`))
  userParts.push('【输出格式】', spec.output.format)

  return { system: `${spec.role}\n${spec.stance}`, user: userParts.join('\n') }
}
