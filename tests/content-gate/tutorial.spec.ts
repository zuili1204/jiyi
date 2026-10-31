import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { scanJson, scanText, hasBlock } from '@/engine/compliance'

/**
 * 教程内容闸（JY-14 §5.3 / J27，T5）
 *
 * 教程是产品**自撰文案**，走 `familiesByKind.tutorial` 的**全词族严扫**（0 豁免），
 * 绝不与签谱原文的豁免策略混淆。此测试验证：
 *  - 明文端点 / 禁词族 → block=0
 *  - 严扫确实开启（关掉也不行：tutorial 本就没有豁免规则）
 */
const MASTER = join(process.cwd(), 'DOCS', 'content', 'tutorial', 'tutorial.json')
/** 发布仓库不提供内容母版：教程闸整组跳过 */
const hasMaster = existsSync(MASTER)

describe.skipIf(!hasMaster)('教程内容闸（全词族严扫）', () => {
  it('母版存在', () => {
    expect(() => readFileSync(MASTER, 'utf8')).not.toThrow()
  })

  it('扫描母版：block = 0（产品自撰文案不得触碰禁词）', () => {
    const doc = JSON.parse(readFileSync(MASTER, 'utf8'))
    const hits = scanJson(doc, 'tutorial')
    expect(hasBlock(hits)).toBe(false)
  })

  it('tutorial 不享受任何原文豁免（dictatest scanJson with options 应同样 block=0）', () => {
    // 直接用 disableExemption 也应是 0 block —— 证明内容本身干净，而非靠豁免
    const doc = JSON.parse(readFileSync(MASTER, 'utf8'))
    const hits = scanJson(doc, 'tutorial', '', { disableExemption: true })
    expect(hasBlock(hits)).toBe(false)
  })

  it('scanText 直接调用同样零命中绝对化断言词族', () => {
    // 教程 full-text 扫描本身就是全词族（scanJson 递归覆盖所有字符串），
    // 此处再直接对平坦文本做一次严扫，作为双保险。
    const text = readFileSync(MASTER, 'utf8')
    const hits = scanText(text, 'tutorial')
    expect(hasBlock(hits)).toBe(false)
  })
})