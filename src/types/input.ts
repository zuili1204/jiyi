/**
 * InputSchema 驱动表单（JY-03 §8 唯一权威源）
 *
 * 一次声明，四处复用：
 * 1. UI 表单自动生成
 * 2. 导出 / 分享自动按 pii 脱敏
 * 3. AI prompt 自动排除 PII 字段
 * 4. 统计自动跳过 PII 维度
 */

export type InputFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'time'
  | 'datetime'
  | 'select'
  | 'place'
  | 'gender'
  | 'toggle'

export interface InputFieldOption {
  label: string
  value: string
}

export interface InputField {
  key: string
  label: string
  type: InputFieldType
  required: boolean
  /** 标记为敏感字段（PII） */
  pii?: boolean
  validate?: (v: unknown) => string | null
  help?: string
  placeholder?: string
  min?: number
  max?: number
  options?: InputFieldOption[]
  /** 日历/历法相关字段：需要公历与农历切换 */
  calendar?: boolean
}

export interface InputSchema {
  fields: InputField[]
}

/**
 * 性别选项（唯一权威源）。
 *
 * 此前 `type: 'gender'` 未声明 options，UI 渲染出一个**空下拉框**（只有"请选择"），
 * 用户点开什么都没有 —— 表单看着能用、实际选不了。这里给出默认值兜底，
 * 任何 `gender` 字段未显式声明 options 时都能正常选男 / 女。
 */
export const GENDER_OPTIONS: InputFieldOption[] = [
  { label: '男', value: 'male' },
  { label: '女', value: 'female' }
]

/** 字段可选项：gender 兜底 GENDER_OPTIONS，其余无 options 即为空 */
export function optionsOf(f: InputField): InputFieldOption[] {
  if (f.options && f.options.length > 0) return f.options
  return f.type === 'gender' ? GENDER_OPTIONS : []
}

/** 取出所有 PII 字段路径（点号路径，例：birth.date） */
export function piiPaths(schema: InputSchema, prefix = ''): string[] {
  const out: string[] = []
  for (const f of schema.fields) {
    const path = prefix ? `${prefix}.${f.key}` : f.key
    if (f.pii) out.push(path)
  }
  return out
}

/**
 * 校验表单值（JY-03 §8）。
 *
 * 健壮性要点（此前会**静默放过非法值**）：
 * - 纯空白字符串按"空"处理（`'   '` 不该算填了）；
 * - `number` 字段先判有限性：`Number('abc') = NaN`，而 `NaN < min` 恒为 false，
 *   旧写法会让非数字一路通过校验、进到引擎里算出 `NaN` 柱；
 * - 数字字段只报第一条错，避免同栏堆两句。
 */
export function validateInput(
  schema: InputSchema,
  value: Record<string, unknown>
): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const f of schema.fields) {
    const v = value[f.key]
    const empty = v === undefined || v === null || (typeof v === 'string' && v.trim() === '')
    if (f.required && empty) {
      errors[f.key] = `请填写${f.label}`
      continue
    }
    if (empty) continue

    if (f.type === 'number') {
      const n = typeof v === 'number' ? v : Number(String(v).trim())
      if (!Number.isFinite(n)) {
        errors[f.key] = `${f.label}必须是数字`
        continue
      }
      if (f.min !== undefined && n < f.min) {
        errors[f.key] = `${f.label}不能小于 ${f.min}`
        continue
      }
      if (f.max !== undefined && n > f.max) {
        errors[f.key] = `${f.label}不能大于 ${f.max}`
        continue
      }
    } else {
      const n = Number(v)
      if (f.min !== undefined && Number.isFinite(n) && n < f.min) {
        errors[f.key] = `${f.label}不能小于 ${f.min}`
      } else if (f.max !== undefined && Number.isFinite(n) && n > f.max) {
        errors[f.key] = `${f.label}不能大于 ${f.max}`
      }
    }

    if (!errors[f.key] && f.validate) {
      const msg = f.validate(v)
      if (msg) errors[f.key] = msg
    }
  }
  return errors
}
