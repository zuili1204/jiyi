import type { DivinationKind } from './types'
import rules from './compliance.rules.json'

/** 内容闸可扫描的 kind：占卜品类 + 教程自撰文案（后续新增 kind 在此扩展） */
export type ContentKind = DivinationKind | 'tutorial'

/**
 * 合规词闸（JY-04 §3.2 / §3.3 唯一权威源）
 *
 * 纪律：
 * - 新词族必须走 JY-08 决策（记录词表版本 + 增补理由），不随手加。
 * - block 命中 → 构建失败；warn 命中 → 记录，不失败但需清零。
 * - 词表与豁免规则的**数据**在 `compliance.rules.json`，由本模块与
 *   `scripts/sync-content.mjs` 共用（此前脚本内各存一份词表，已合并，见 R3）。
 *
 * 豁免纪律（JY-04 §3.4 自指豁免）：
 *   传统签谱原文含「病」「孕」「生男」等表述，与 `medical` / `gender` 词族直接冲突。
 *   **豁免绝不等于关闸** —— 被豁免的路径改走等价强度检查：
 *     ① `provenance`  母版必须声明 source / license / school（否则豁免失效并 block）
 *     ② `placeholder` 占位符残留
 *     ③ `reduplication` 叠词
 *     ④ `length` 长度
 *     ⑤ `exemptCountAudit` 豁免条目计数登记（可审计）
 *   任一替代检查失败即 block；`disableExemption` 可强制走全词族扫描（供自检用例使用）。
 */

export type WordFamily =
  | 'absolute'
  | 'medical'
  | 'invest'
  | 'legal'
  | 'gender'
  | 'doom'
  | 'fate'
  | 'religion'
  | 'yingqi'
  | 'authority'

export interface WordRule {
  family: WordFamily
  level: 'block' | 'warn'
  words: string[]
}

export interface ExemptionRule {
  id: string
  kind: ContentKind | '*'
  /** 支持 `*` 通配单段，例：`items[*].poem[*]` */
  paths: string[]
  reason: string
  /** 豁免生效的前提：母版必须声明这些顶层字段 */
  requires: string[]
  /** 替代检查项（即"换一种等价强度的检查"） */
  alternativeChecks: string[]
}

export const COMPLIANCE_WORDS_VERSION: number = rules.version

export const COMPLIANCE_WORDS: WordRule[] = (
  Object.entries(rules.families) as [WordFamily, { level: 'block' | 'warn'; words: string[] }][]
).map(([family, v]) => ({ family, level: v.level, words: [...v.words] }))

/** 各品类启用的词族（JY-04 §3.3） */
export const FAMILY_BY_KIND = rules.familiesByKind as unknown as Record<
  ContentKind,
  WordFamily[]
>

export const COMPLIANCE_EXEMPTIONS = rules.exemptions as unknown as ExemptionRule[]

export const PLACEHOLDERS: string[] = [...rules.placeholders]
export const REDUPLICATION_PATTERN: string = rules.reduplicationPattern
export const MAX_TEXT_LENGTH: number = rules.maxTextLength

interface LengthOverride {
  paths: string[]
  max: number
  reason?: string
}

const LENGTH_OVERRIDES = (rules.maxTextLengthOverrides ?? []) as LengthOverride[]

/** 长度阈值：默认 300 字；长篇原文字段（如解曰）走 override */
export function lengthLimitFor(path: string): number {
  for (const o of LENGTH_OVERRIDES) {
    if (o.paths.some((p) => matchPathPattern(p, path))) return o.max
  }
  return MAX_TEXT_LENGTH
}

export interface ComplianceHit {
  family: WordFamily | 'placeholder' | 'reduplication' | 'length' | 'provenance' | 'structure'
  level: 'block' | 'warn'
  word: string
  path: string
}

/** 把 `items[0].poem[1]` 归一为 `items[*].poem[*]`，便于与豁免 pattern 比对 */
function normalizePath(path: string): string {
  return path.replace(/\[\d+\]/g, '[*]')
}

/** 路径通配匹配：按 `.` 分段，`*` 匹配任意单段 */
export function matchPathPattern(pattern: string, path: string): boolean {
  const p = normalizePath(pattern).split('.')
  const a = normalizePath(path).split('.')
  if (p.length !== a.length) return false
  return p.every((seg, i) => seg === '*' || seg === a[i])
}

/** 该路径是否命中豁免；返回命中的豁免规则 */
export function findExemption(kind: ContentKind, path: string): ExemptionRule | undefined {
  return COMPLIANCE_EXEMPTIONS.find(
    (e) => (e.kind === '*' || e.kind === kind) && e.paths.some((p) => matchPathPattern(p, path))
  )
}

/**
 * 等价强度检查之一：溯源校验。
 * 豁免只在母版声明了 `requires` 字段（且非空、非占位值）时成立。
 */
export function missingProvenance(doc: unknown, required: readonly string[] = ['source', 'license']): string[] {
  const missing: string[] = []
  if (!doc || typeof doc !== 'object') return [...required]
  const obj = doc as Record<string, unknown>
  for (const key of required) {
    const v = obj[key]
    if (typeof v !== 'string' || v.trim() === '' || v.trim() === 'unknown') missing.push(key)
  }
  return missing
}

export interface ScanOptions {
  /** 强制关闭路径豁免，走全词族扫描（自检用例用） */
  disableExemption?: boolean
  /** 命中豁免时累加计数，供审计输出 */
  exemptAudit?: { count: number; byId: Record<string, number> }
}

/**
 * 扫描文本中的合规词。
 * @param path 用于定位的字段路径（例：lots.guanyin.items[0].poem[1]）
 */
export function scanText(
  text: string,
  kind: ContentKind,
  path = '',
  opts: ScanOptions = {}
): ComplianceHit[] {
  if (!opts.disableExemption && path) {
    const ex = findExemption(kind, path)
    if (ex) {
      if (opts.exemptAudit) {
        opts.exemptAudit.count += 1
        opts.exemptAudit.byId[ex.id] = (opts.exemptAudit.byId[ex.id] ?? 0) + 1
      }
      return []
    }
  }

  const enabled = new Set(FAMILY_BY_KIND[kind] ?? [])
  const hits: ComplianceHit[] = []
  for (const rule of COMPLIANCE_WORDS) {
    if (!enabled.has(rule.family)) continue
    for (const w of rule.words) {
      if (text.includes(w)) hits.push({ family: rule.family, level: rule.level, word: w, path })
    }
  }
  return hits
}

/**
 * 被豁免路径的替代检查（占位 / 叠词 / 长度）——与词族扫描同等强度的另一组检查。
 */
export function scanExemptText(text: string, path: string): ComplianceHit[] {
  const hits: ComplianceHit[] = []
  for (const p of PLACEHOLDERS) {
    if (text.includes(p)) hits.push({ family: 'placeholder', level: 'block', word: p, path })
  }
  if (new RegExp(REDUPLICATION_PATTERN).test(text)) {
    hits.push({ family: 'reduplication', level: 'block', word: '叠词', path })
  }
  const limit = lengthLimitFor(path)
  if (text.length > limit) {
    hits.push({ family: 'length', level: 'warn', word: `${text.length} 字（阈值 ${limit}）`, path })
  }
  return hits
}

/** 递归扫描任意 JSON（供内容闸脚本使用） */
export function scanJson(
  value: unknown,
  kind: ContentKind,
  path = '',
  opts: ScanOptions = {}
): ComplianceHit[] {
  const hits: ComplianceHit[] = []
  if (typeof value === 'string') {
    const exempt = !opts.disableExemption && !!path && !!findExemption(kind, path)
    if (exempt) {
      if (opts.exemptAudit) {
        opts.exemptAudit.count += 1
        for (const e of COMPLIANCE_EXEMPTIONS) {
          if ((e.kind === '*' || e.kind === kind) && e.paths.some((p) => matchPathPattern(p, path))) {
            opts.exemptAudit.byId[e.id] = (opts.exemptAudit.byId[e.id] ?? 0) + 1
          }
        }
      }
      hits.push(...scanExemptText(value, path))
    } else {
      hits.push(...scanText(value, kind, path, opts))
    }
    return hits
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => hits.push(...scanJson(v, kind, `${path}[${i}]`, opts)))
    return hits
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      hits.push(...scanJson(v, kind, path ? `${path}.${k}` : k, opts))
    }
  }
  return hits
}

export function hasBlock(hits: ComplianceHit[]): boolean {
  return hits.some((h) => h.level === 'block')
}
