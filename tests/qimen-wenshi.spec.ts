import { describe, it, expect, beforeAll } from 'vitest'
import { qimenChaibuEngine, setQimenTemplateProvider, SAN_MEN } from '@/engine/qimen'
import { bootstrapContent } from '@/data/content/bootstrap'
import { qimenTemplateItems, QIMEN_TPL_META } from '@/data/content/qimen'
import { PALACE_DIRECTION } from '@/engine/qimen/constants'

/**
 * Y6-06 问事解读与择时择方模板
 *
 * 纪律（与 JY-04 §3 / JY-14 §4.1 同口径）：
 * 1. 只测**结构呈现与传统口径介绍**，不测"解读准不准"（那要典籍核校）；
 * 2. 模板缺失必须走 L3：只给落宫与方位，**不编造断语**；
 * 3. 不因问事文本自动分类（`wenShiKey` 未给即综合口径）；
 * 4. 全文过禁词族（absolute / doom / authority / yingqi …）—— 自撰文案不豁免。
 */
const AT = { year: 2024, month: 3, day: 20, hour: 10, minute: 30 }
/** 奇门起局是确定性的（时间决定局数），不消耗随机源；签名要求传入，给固定桩 */
const RNG = { next: () => 0, int: () => 0 }

function interp() {
  const r = qimenChaibuEngine.compute({ at: AT }, RNG)
  return qimenChaibuEngine.interpret(r)
}

/** 内容闸禁词（取 compliance.rules.json 中 block 级词族的代表词） */
const BLOCK_WORDS = [
  '必定',
  '一定会',
  '必然发生',
  '注定',
  '百分百',
  '逃不掉',
  '铁定',
  '毫无疑问会',
  '血光',
  '横死',
  '夭折',
  '绝后',
  '家破人亡',
  '大祸临头',
  '凶灾',
  '皈依',
  '供奉',
  '因果报应',
  '神罚',
  '大师亲授',
  '官方认证',
  '最准',
  '第一准'
]

describe('Y6-06 模板母版（结构 + 合规）', () => {
  it('母版条目齐全：问事 6 / 取用门 8 / 方位 9 / 择时 1 / 整体 1', () => {
    const dim = (d: string) => qimenTemplateItems.filter((t) => t.dim === d)
    expect(dim('wenShi')).toHaveLength(6)
    expect(dim('yongMen')).toHaveLength(8)
    expect(dim('fangWei')).toHaveLength(9)
    expect(dim('zeShi')).toHaveLength(1)
    expect(dim('overall')).toHaveLength(1)
    expect(QIMEN_TPL_META.reviewed).toBe(false)
  })

  it('八门取用条目覆盖开休生伤杜景死惊八门（数据口径：单字门名）', () => {
    const keys = qimenTemplateItems.filter((t) => t.dim === 'yongMen').map((t) => t.key)
    // ⚠️ pan.doors 存单字门名（DOOR_ORDER），模板 key 必须与之对齐，写成「开门」取不到
    for (const m of ['开', '休', '生', '伤', '杜', '景', '死', '惊']) {
      expect(keys).toContain(m)
    }
    expect(keys).not.toContain('开门')
  })

  it('全部模板文本零 block 级禁词（自撰文案不豁免）', () => {
    for (const it of qimenTemplateItems) {
      for (const w of BLOCK_WORDS) {
        expect(it.text.includes(w)).toBe(false)
      }
      // 占位 / 溯源结构件
      expect(it.text).not.toContain('TODO')
      expect(it.id).toBeTruthy()
    }
  })

  it('九宫方位常量齐全，中宫如实标注「不主方位」', () => {
    expect(Object.keys(PALACE_DIRECTION)).toHaveLength(9)
    expect(PALACE_DIRECTION[5]).toContain('中宫')
    expect(PALACE_DIRECTION[5]).toContain('不主方位')
    expect(PALACE_DIRECTION[1]).toContain('北')
    expect(PALACE_DIRECTION[9]).toContain('南')
  })
})

describe('Y6-06 引擎接线', () => {
  it('模板未装载 → L3 兜底：只给结构与方位，明确不编造断语', () => {
    // 本文件在 beforeAll 之前、provider 未注入
    setQimenTemplateProvider(() => [])
    const b = interp()
    const keys = b.blocks.map((x) => x.key)
    expect(keys).toContain('y6Pending')
    expect(keys).not.toContain('wenShi')
    expect(keys).not.toContain('zeFang')
    const pending = b.blocks.find((x) => x.key === 'y6Pending')!
    expect(pending.text).toContain('不编造断语')
  })

  describe('装入内容层模板后', () => {
    beforeAll(() => {
      bootstrapContent()
    })

    it('问事取用 / 取用门 / 择方 / 择时 / 整体 五个块都在', () => {
      const b = interp()
      const keys = b.blocks.map((x) => x.key)
      expect(keys).toContain('wenShi')
      expect(keys).toContain('yongMen')
      expect(keys).toContain('zeFang')
      expect(keys).toContain('zeShi')
      expect(keys).toContain('qimenOverall')
    })

    it('问事类别不自动推断：未指定即按综合口径', () => {
      const b = interp()
      const wen = b.blocks.find((x) => x.key === 'wenShi')!
      expect(wen.label).toContain('综合')
    })

    it('取用参照给出开 / 休 / 生三门的落宫与方位', () => {
      const b = interp()
      const men = b.blocks.find((x) => x.key === 'yongMen')!
      for (const m of SAN_MEN) {
        expect(men.text).toContain(`${m}门`)
      }
      expect(men.text).toMatch(/宫（/)
    })

    it('择方只呈现方位结构，不作出行建议', () => {
      const b = interp()
      const zf = b.blocks.find((x) => x.key === 'zeFang')!
      expect(zf.text).toContain('所在方位')
      expect(zf.text).toContain('不构成出行或方位建议')
    })

    it('择时给出本局起局时刻与时柱，且不推定吉时', () => {
      const b = interp()
      const zs = b.blocks.find((x) => x.key === 'zeShi')!
      expect(zs.text).toContain('2024-03-20 10:30')
      expect(zs.text).toMatch(/时柱/)
      expect(zs.text).toContain('不推定吉时')
    })

    it('结果全文零 block 级禁词，且保留「不做吉凶断语」披露', () => {
      const b = interp()
      const all = b.blocks.map((x) => x.text).join('\n')
      for (const w of BLOCK_WORDS) expect(all.includes(w)).toBe(false)
      expect(all).toContain('本盘不做吉凶断语')
    })
  })
})
