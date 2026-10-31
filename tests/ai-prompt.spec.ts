import { describe, expect, it } from 'vitest'
import { AI_PROMPT_SPEC, bannedWordsFor, buildAiPrompt } from '@/engine/ai/prompt'
import { FAMILY_BY_KIND } from '@/engine/compliance'
import { DIVINATION_KINDS, type DivinationKind } from '@/engine/types'
import type { ReadingRecord } from '@/types/reading'

/**
 * AI Prompt 组装（JY-07 §5 / §9）
 *
 * 覆盖验收：
 * - §9-1：每个 kind 有可用分支，输出结构一致；
 * - §9-2（prompt 侧）：关闭敏感开关时出生数据不进 prompt（请求体侧见 ai-client.spec）；
 * - JY-04 §3.4：ai-prompt.json 结构校验（自指豁免的替代检查）。
 */

const METHOD_BY_KIND: Record<DivinationKind, string> = {
  lots: 'sign',
  iching: 'liujiao',
  bazi: 'sizhu',
  ziwei: 'minggong',
  qimen: 'chaibu'
}

const BASIS_BY_KIND: Record<DivinationKind, Record<string, unknown>> = {
  lots: { index: 12 },
  iching: {
    lines: [true, false, true, false, true, false],
    dongYao: [2],
    benGua: { index: 1, name: '乾为天', upper: '乾', lower: '乾' },
    bianGua: { index: 38, name: '火泽睽', upper: '离', lower: '兑' }
  },
  bazi: {
    pillars: {
      year: { text: '庚午' },
      month: { text: '戊子' },
      day: { text: '甲辰' },
      time: { text: '丙寅' }
    },
    geJu: '正印格',
    daYun: [{ ganzhi: '己丑' }]
  },
  ziwei: {
    mingGong: { name: '命宫', stars: ['紫微'] },
    siHuaByPalace: { huaLu: '命宫' }
  },
  qimen: {
    qimenPan: [{ palace: 1, name: '休门', star: '天蓬', door: '休门', god: '值符' }],
    maXingPalace: 3
  }
}

function fakeRecord(kind: DivinationKind, over: Partial<ReadingRecord> = {}): ReadingRecord {
  const input: Record<string, unknown> =
    kind === 'bazi'
      ? {
          at: { year: 1990, month: 1, day: 1, hour: 8, minute: 0 },
          place: '北京市',
          gender: 'male',
          question: '问事业'
        }
      : { question: '问出行' }
  return {
    id: 't1',
    kind,
    method: METHOD_BY_KIND[kind],
    schemaVersion: 1,
    dataVersion: 1,
    createdAt: 0,
    input,
    result: {},
    interpretation: {
      title: '测试标题',
      summary: '摘要',
      blocks: [{ key: 'poem', label: '签诗', text: '甲乙丙丁' }],
      basis: BASIS_BY_KIND[kind]
    },
    piiFields: [],
    ...over
  } as ReadingRecord
}

describe('ai-prompt.json 结构校验（JY-04 §3.4 自指豁免的替代检查）', () => {
  it('role / stance / output / labels 齐全且非空', () => {
    expect(AI_PROMPT_SPEC.version).toBeGreaterThan(0)
    expect(AI_PROMPT_SPEC.role.trim().length).toBeGreaterThan(10)
    expect(AI_PROMPT_SPEC.stance).toContain('仅供参考')
    expect(AI_PROMPT_SPEC.output.format.trim().length).toBeGreaterThan(10)
    expect(AI_PROMPT_SPEC.output.sections.length).toBe(4)
    expect(AI_PROMPT_SPEC.labels).toEqual(AI_PROMPT_SPEC.output.sections)
  })

  it('kind 分支齐全：五个品类各有 intro / fields / forbidden', () => {
    for (const kind of DIVINATION_KINDS) {
      const spec = AI_PROMPT_SPEC.kinds[kind]
      expect(spec, `${kind} 缺分支`).toBeTruthy()
      expect(spec.intro.trim().length).toBeGreaterThan(5)
      expect(Object.keys(spec.fields).length).toBeGreaterThan(0)
      expect(spec.forbidden.length).toBeGreaterThan(0)
      expect(spec.forbidden.every((f) => f.trim().length > 0)).toBe(true)
    }
  })
})

describe('按 kind 的 prompt 分支（JY-07 §9-1）', () => {
  const DIGEST_MARK: Record<DivinationKind, string> = {
    lots: '签号：12',
    iching: '乾为天',
    bazi: '庚午 戊子 甲辰 丙寅',
    ziwei: '紫微',
    qimen: '天蓬'
  }

  it('每个 kind 都产出可用 prompt，且骨架一致', () => {
    let systemFirst: string | undefined
    for (const kind of DIVINATION_KINDS) {
      const { system, user } = buildAiPrompt(fakeRecord(kind))
      expect(system.trim()).not.toBe('')
      expect(user).toContain('【结果数据】')
      expect(user).toContain('【禁止】')
      expect(user).toContain('【输出格式】')
      // 输出结构一致：四小节格式原文进入每个分支
      expect(user).toContain(AI_PROMPT_SPEC.output.format)
      // 该 kind 的分支引语与要素摘要确实进入
      expect(user).toContain(AI_PROMPT_SPEC.kinds[kind].intro.slice(0, 10))
      expect(user).toContain(DIGEST_MARK[kind])
      // 禁用词原样列举（该品类启用的词族）
      expect(user).toContain(`禁用词（以下词语一个都不许出现在输出中）：${bannedWordsFor(kind).join('、')}`)

      if (systemFirst === undefined) systemFirst = system
      else expect(system).toBe(systemFirst) // system 各 kind 一致
    }
  })

  it('所问进入 prompt；签诗等解读分块全量给模型', () => {
    const { user } = buildAiPrompt(fakeRecord('lots'))
    expect(user).toContain('【所问】问出行')
    expect(user).toContain('签诗：甲乙丙丁')
  })

  it('禁用词清单与内容闸词表同源：按品类启用词族过滤', () => {
    // absolute 在所有品类都启用
    expect(bannedWordsFor('lots')).toContain('注定')
    // yingqi 只在 iching / bazi / ziwei / qimen 启用，lots 不含
    expect(bannedWordsFor('iching')).toContain('三个月内必')
    expect(bannedWordsFor('lots')).not.toContain('三个月内必')
    // 与 familiesByKind 字面一致
    for (const kind of DIVINATION_KINDS) {
      const families = FAMILY_BY_KIND[kind]
      expect(bannedWordsFor(kind).length).toBeGreaterThan(0)
      expect(families.length).toBeGreaterThan(0)
    }
  })
})

describe('PII 规则（JY-07 §5 / §9-2 的 prompt 侧）', () => {
  it('关闭敏感开关：出生数据一律不进 prompt，并明示"不询问不反推"', () => {
    const { user } = buildAiPrompt(fakeRecord('bazi'))
    expect(user).not.toContain('北京市')
    expect(user).not.toContain('1990')
    expect(user).not.toContain('male')
    expect(user).not.toContain('出生数据（用户已明确同意发送）')
    expect(user).toContain('不要询问或反推')
  })

  it('显式同意（allowSensitive=true）后出生数据随请求发送', () => {
    const { user } = buildAiPrompt(fakeRecord('bazi'), { allowSensitive: true })
    expect(user).toContain('出生数据（用户已明确同意发送）')
    expect(user).toContain('北京市')
    expect(user).toContain('1990')
  })

  it('签占等无 PII 品类：开敏感开关也不产生出生数据段', () => {
    const { user } = buildAiPrompt(fakeRecord('lots'), { allowSensitive: true })
    expect(user).not.toContain('出生数据（用户已明确同意发送）')
  })
})
