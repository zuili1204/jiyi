import type { DivinationKind, Interpretation } from '@/engine/types'

/**
 * 统一记录模型（JY-03 §4.2 / §4.3 唯一权威源）
 *
 * 纪律：只增不改；禁用破坏性重建。
 */

export const SCHEMA_VERSION = 1

/**
 * 子玩法 → 显示名（唯一权威源）。
 *
 * 新增玩法时**必须同步此处**，否则列表 / 详情页会露出裸 `method` 键
 * （此前首页与历史页各抄一份，已合并）。未登记的一律原样返回，不猜中文名。
 */
export const METHOD_LABEL: Record<string, string> = {
  sign: '签占',
  liujiao: '六爻',
  meihua: '梅花',
  sizhu: '八字',
  minggong: '紫微',
  chaibu: '奇门',
  coin: '内部验证'
}

export function methodLabel(method: string): string {
  return METHOD_LABEL[method] ?? method
}

/**
 * 子玩法 → 品类识别色（值为 tokens.css 既有变量，不造新色）。
 *
 * 列表与详情用它做视觉区隔：一屏扫过去，八字 / 奇门 / 六爻靠色条即可分。
 * 与 METHOD_LABEL 同处一地：新增玩法必须两处同步，否则露出灰色兜底。
 *
 * 键名有两族：记录用键（sign/sizhu/minggong/chaibu…）与品类键
 * （lots/bazi/ziwei/qimen，教程卡与场景推荐在用），同色并列登记。
 */
export const METHOD_ACCENT: Record<string, string> = {
  sign: 'var(--cinnabar-bright)',
  liujiao: 'var(--wx-water)',
  meihua: 'var(--wx-wood)',
  sizhu: 'var(--wx-earth)',
  minggong: 'var(--bronze-bright)',
  chaibu: 'var(--wx-metal)',
  coin: 'var(--text-3)',
  // 品类键（教程等处使用），与对应记录键同色
  lots: 'var(--cinnabar-bright)',
  bazi: 'var(--wx-earth)',
  ziwei: 'var(--bronze-bright)',
  qimen: 'var(--wx-metal)'
}

export function methodAccent(method: string): string {
  return METHOD_ACCENT[method] ?? 'var(--text-3)'
}

/** 记录上限（JY-03 §7.2）：达到后提示导出并手动清理，不静默删除 */
export const RECORD_LIMIT = 200

export interface AiInterpretation {
  /** 模型输出原文，保留可审计（JY-07 §6：后检只标记不改写） */
  text: string
  model?: string
  createdAt: number
  /** 后检命中的禁词族，只记录不改写 */
  flagged?: string[]
}

export interface ReadingRecord {
  id: string
  kind: DivinationKind
  /** 子玩法键：'guanyin' | 'liujiao' | 'meihua' | ...（JY-01 §1.1） */
  method: string
  schemaVersion: number
  /** 内容版本：产文即快照 */
  dataVersion: number
  createdAt: number

  /** 起卦 / 排盘原始输入（可能含 PII） */
  input: Record<string, unknown>
  /** 结构化结果（签号 / 卦象 / 命盘 / 式盘） */
  result: Record<string, unknown>
  /** 解读文本（快照，不回写） */
  interpretation: Interpretation
  ai?: AiInterpretation

  /** 敏感字段路径清单：导出脱敏与统计排除用 */
  piiFields?: string[]
  /** 排盘依据：保证三个月后仍能解释"当时为什么这么排" */
  basis?: Record<string, unknown>
}

/**
 * 迁移表：结构在，内容为空（第一版无历史）。
 *
 * 纪律：key 为「从版本 n 升到 n+1」，只增不改；MIGRATIONS[n] 必须把 n 升到 n+1。
 */
export const MIGRATIONS: Record<number, (r: Record<string, any>) => Record<string, any>> = {}

/** 新字段的默认值：保证旧备份导入后不会运行到 undefined（JY-03 §4.3） */
const DEFAULTS: Partial<ReadingRecord> = {
  schemaVersion: SCHEMA_VERSION,
  dataVersion: 0,
  input: {},
  result: {},
  piiFields: []
}

/**
 * 把任意版本的记录迁移到当前 SCHEMA_VERSION。
 * - 版本高于当前 → 抛错（拒绝降级解析）
 * - 迁移链断裂 → 抛错（不做静默跳过）
 */
export function migrateRecord(raw: Record<string, any>): ReadingRecord {
  if (!raw || typeof raw !== 'object') throw new Error('记录格式非法')
  if (typeof raw.schemaVersion !== 'number') throw new Error('记录缺少 schemaVersion')
  if (raw.schemaVersion > SCHEMA_VERSION) {
    throw new Error(`备份来自更新版本（schemaVersion=${raw.schemaVersion} > ${SCHEMA_VERSION}）`)
  }

  let r: Record<string, any> = { ...DEFAULTS, ...raw }
  for (let v = r.schemaVersion; v < SCHEMA_VERSION; v++) {
    const m = MIGRATIONS[v]
    if (!m) throw new Error(`缺少迁移函数 MIGRATIONS[${v}]，无法从 v${v} 升级`)
    r = m(r)
    r.schemaVersion = v + 1
  }
  return r as unknown as ReadingRecord
}
