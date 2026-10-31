import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * golden 测试装载器（JY-02 §5）
 *
 * 纪律：
 * - 期望值只能来自**权威来源**（典籍 / 工具 / 专家），不得由实现反推。
 * - 用例未采集完成 → 该用例标记为 pending（可见、可统计），**不允许用 skip 静默跳过**。
 * - 用例缺失或字段不全 → 直接失败（暴露缺口，而不是假装通过）。
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
export const GOLDEN_DATA_DIR = join(ROOT, 'DOCS', 'golden')

export interface GoldenCase<I = any, E = any> {
  id: string
  kind: string
  method: string
  /** 流派，须与 JY-01 §7 字面一致 */
  school?: string
  input: I
  expect: E
  tolerance?: Record<string, number>
  source: string
  sourceKind?: 'book' | 'tool' | 'expert'
  /** 第二独立来源（JY-02 §5.4：至少 2 个来源一致才入库） */
  verifiedBy?: string
  note?: string
  /** 未采集完成：置 true 会显式 pending 并在报告中计数 */
  todo?: boolean
}

export interface GoldenSuite<I = any, E = any> {
  suite: string
  kind: string
  method: string
  cases: GoldenCase<I, E>[]
}

export function loadGoldenSuite<I = any, E = any>(name: string): GoldenSuite<I, E> {
  const file = join(GOLDEN_DATA_DIR, `${name}.json`)
  if (!existsSync(file)) {
    // 缺口必须显式暴露（JY-02 §5.5）
    throw new Error(
      `golden 数据文件缺失：DOCS/golden/${name}.json —— 用例采集是品类开工前置，请先完成 Y0-03 / Y0-04`
    )
  }
  const data = JSON.parse(readFileSync(file, 'utf8')) as GoldenSuite<I, E>
  if (!Array.isArray(data.cases)) throw new Error(`${name}.json 缺少 cases 数组`)
  for (const c of data.cases) {
    if (!c.id || !c.source) throw new Error(`${name}.json 存在缺少 id/source 的用例`)
    if (c.todo !== true && !c.verifiedBy) {
      throw new Error(
        `${name}.json 用例 ${c.id} 缺少 verifiedBy（第二独立来源）。` +
          `若尚未采集完成，请把该用例标记 "todo": true`
      )
    }
  }
  return data
}
