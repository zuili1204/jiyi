import { scanText, type ComplianceHit, type WordFamily } from '@/engine/compliance'
import type { DivinationKind } from '@/engine/types'

/**
 * AI 输出后检（JY-07 §6 唯一权威源）：**只标记，不改写**
 *
 * - 命中禁词 → 记录 `flagged`（词族清单）+ UI 提示，**原文原样保留** ——
 *   改写了就无法复盘模型到底说了什么，可审计性 > 表面干净（YR22：不因 AI 而放宽内容闸）；
 * - AI 输出是现代生成文本，不是传统原文：**走全词族严检、不适用任何传统原文豁免**。
 */
export interface AiScanResult {
  /** 命中的禁词族（去重） */
  flagged: WordFamily[]
  hits: ComplianceHit[]
}

export function scanAiOutput(text: string, kind: DivinationKind): AiScanResult {
  // disableExemption：双保险 —— 即使将来出现与豁免路径同形的规则，AI 输出也不豁免
  const hits = scanText(text, kind, 'ai.output', { disableExemption: true })
  const flagged = [...new Set(hits.map((h) => h.family))] as WordFamily[]
  return { flagged, hits }
}
