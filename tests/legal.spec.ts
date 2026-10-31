import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DISCLAIMER, POLICY_CONTACT, PRIVACY_POLICY } from '@/data/legal'

/**
 * 隐私政策（`JY-04 §5.2` 七条）
 *
 * 上架会被打回的往往不是"没写"，而是"写了但缺某一条 / 承诺写歪了"。
 * 所以把七条与关键承诺做成可判定的断言，而不是靠人肉检查。
 */
const KEYS = ['collect', 'purpose', 'upload', 'retention', 'rights', 'ai', 'children'] as const
const NUMERALS = ['一', '二', '三', '四', '五', '六', '七']
const POLICY_MD = join(process.cwd(), 'DOCS', 'legal', '隐私政策.md')
const hasPolicyMd = existsSync(POLICY_MD)

function section(key: (typeof KEYS)[number]) {
  const s = PRIVACY_POLICY.find((x) => x.key === key)
  if (!s) throw new Error(`缺第 ${key} 条`)
  return s
}

describe('隐私政策（JY-04 §5.2 七条）', () => {
  it('七条齐全，且顺序与编号一致', () => {
    expect(PRIVACY_POLICY.map((s) => s.key)).toEqual([...KEYS])
    PRIVACY_POLICY.forEach((s, i) => expect(s.title.startsWith(`${NUMERALS[i]}、`)).toBe(true))
  })

  it('第三条：不上传 / 不共享 / 不画像，三个承诺都在', () => {
    const body = section('upload').body
    expect(body).toContain('不上传')
    expect(body).toContain('不共享')
    expect(body).toContain('不画像')
  })

  it('第五条：导出 / 删除 / 清空 / 撤回同意 四项权利齐全', () => {
    const body = section('rights').body
    for (const k of ['导出', '删除', '清空', '撤回同意']) expect(body).toContain(k)
  })

  it('第六条：AI 为 BYOK，不经我方服务器', () => {
    const body = section('ai').body
    expect(body).toContain('BYOK')
    expect(body).toContain('不经任何我方服务器')
  })

  it('第七条：有儿童与年龄提示', () => {
    const body = section('children').body
    expect(body).toContain('未成年人')
    expect(body).toContain('监护人')
  })

  it('免责声明含医疗 / 投资 / 法律三项排除', () => {
    for (const k of ['医疗', '投资', '法律']) expect(DISCLAIMER).toContain(k)
  })

  it('主体与联系方式未确定前一律留白，不编造', () => {
    expect(POLICY_CONTACT.operator).toContain('待填')
    expect(POLICY_CONTACT.email).toContain('待填')
  })

  it.skipIf(!hasPolicyMd)('DOCS 版与应用内文本同源：七条标题与免责逐条一致', () => {
    const md = readFileSync(POLICY_MD, 'utf8')
    for (const s of PRIVACY_POLICY) expect(md).toContain(s.title)
    expect(md).toContain(DISCLAIMER)
  })
})
