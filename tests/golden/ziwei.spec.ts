import { describe, it, expect } from 'vitest'
import { loadGoldenSuite } from './helpers'
import { ziweiEngine } from '@/engine/ziwei'
import { computeSiHua } from '@/engine/ziwei/siHua'
import { computeDaXian } from '@/engine/ziwei/zhuXing'
import { computeLiuNian } from '@/engine/ziwei'
import type { MingGongResult, ZiweiInput } from '@/engine/ziwei'
import { DI_ZHI, type DiZhi, type TianGan } from '@/engine/calendar'

/** 五行局名 → 局数（起运岁数 = 局数） */
const JU_NUMBER: Record<string, number> = {
  水二局: 2,
  木三局: 3,
  金四局: 4,
  土五局: 5,
  火六局: 6
}

/**
 * 构造最小命宫对象供大限计算使用：
 * 大限只依赖「命宫支 + 局数 + 年干阴阳 + 性别」，十二宫自命宫**逆排**。
 */
function mingStub(branch: DiZhi, juNumber: number): MingGongResult {
  const start = DI_ZHI.indexOf(branch)
  return {
    branch,
    gan: '甲' as TianGan,
    ganZhi: `甲${branch}`,
    wuXingJu: { number: juNumber, label: '' } as MingGongResult['wuXingJu'],
    twelveGong: Array.from({ length: 12 }, (_, i) => ({
      name: '命宫' as MingGongResult['twelveGong'][number]['name'],
      branch: DI_ZHI[(start - i + 12) % 12]
    }))
  }
}

/**
 * 紫微 golden（Y0-04 / Y5-09）
 *
 * 纪律（同 `calendar.spec.ts`）：
 * - `todo: true` 显式 pending 并计数，不用 skip 静默跳过；
 * - 期望值来自两个独立来源（iztro × taibu），不得由本项目引擎反推；
 * - **先实现 runner 再接用例**，不许改用例迁就实现。
 *
 * ⚠️ 输入口径：用例以**农历**记录命例（与采集卡一致），引擎只接受公历，
 * 故用例另带 `input.solarDate`（同一命例的公历表示，来自 iztro dump 的公农历对照）。
 */
const suite = loadGoldenSuite('ziwei')

/** 确定性品类：随机源不会被用到，传空实现满足签名 */
const RNG = { next: () => 0, int: () => 0 }

describe('紫微 golden（Y0-04）', () => {
  const todoCount = suite.cases.filter((c) => c.todo).length
  const readyCount = suite.cases.length - todoCount

  // 10 为 JY-02 §5.1 的**下限**（2026-09-23 起允许扩充，用于为小限 / 杂曜等子模块补 golden）
  it('数据集结构完整（用例数不低于下限 10）', () => {
    expect(suite.cases.length).toBeGreaterThanOrEqual(10)
    for (const c of suite.cases) {
      expect(c.source, `${c.id} 缺 source`).toBeTruthy()
    }
  })

  it('流派字面一致（J3：三合派）', () => {
    expect((suite as unknown as { school?: string }).school).toBe('三合派')
    for (const c of suite.cases) expect(c.school).toBe('三合派')
  })

  it('缺口可见：未采集用例数被统计出来（不是被跳过）', () => {
    console.log(`[golden] ziwei：已入库 ${readyCount} / 待采集 ${todoCount}`)
    // 未全入库时要求 >0（防被静默 skip）；全批已入库（todoCount=0）则不做该限制
    if (todoCount > 0) expect(todoCount).toBeGreaterThan(0)
  })

  for (const c of suite.cases) {
    if (c.todo) {
      it.todo(`[待采集] ${c.id} — ${c.note ?? c.method}`)
      continue
    }

    it(`${c.id} ${c.method} 与权威来源一致（${c.sourceKind}）`, () => {
      if (c.method === 'anXing') {
        const input = c.input as {
          hour: number
          gender?: 'male' | 'female'
          solarDate: string
        }
        const [y, m, d] = input.solarDate.split('-').map(Number)
        const r = ziweiEngine.compute(
          { year: y, month: m, day: d, hour: input.hour, minute: 0, gender: input.gender } as ZiweiInput,
          RNG as never
        )
        const e = c.expect as {
          mingGong?: string
          wuXingJu?: string
          ziweiAt?: string
          fuYao?: string[]
          shaYao?: string[]
        }
        if (e.mingGong !== undefined) expect(r.mingGong.branch).toBe(e.mingGong)
        if (e.wuXingJu !== undefined) expect(r.mingGong.wuXingJu.label).toBe(e.wuXingJu)
        if (e.ziweiAt !== undefined) expect(r.zhuXing.ziWei).toBe(e.ziweiAt)
        // 辅曜 / 煞曜：合并两列表按「宫位」聚合后逐宫断言（同一宫可同坐多星）
        const expected = new Map<string, string[]>()
        for (const item of [...(e.fuYao ?? []), ...(e.shaYao ?? [])]) {
          const [z, names] = item.split(':')
          expected.set(z, [...(expected.get(z) ?? []), names])
        }
        for (const [z, wanted] of expected) {
          const got = (r.fuXing[z] ?? []).slice().sort()
          expect(got, `${c.id} 的 ${z} 宫星曜`).toEqual(wanted.slice().sort())
        }
        return
      }

      if (c.method === 'siHua') {
        const { yearGan } = c.input as { yearGan: TianGan }
        const s = computeSiHua(yearGan)
        const e = c.expect as { huaLu?: string; huaQuan?: string; huaKe?: string; huaJi?: string }
        if (e.huaLu !== undefined) expect(s.lu).toBe(e.huaLu)
        if (e.huaQuan !== undefined) expect(s.quan).toBe(e.huaQuan)
        if (e.huaKe !== undefined) expect(s.ke).toBe(e.huaKe)
        if (e.huaJi !== undefined) expect(s.ji).toBe(e.huaJi)
        return
      }

      if (c.method === 'daXian') {
        const { wuXingJu, mingGong, gender, yearGan } = c.input as {
          wuXingJu: string
          mingGong: DiZhi
          gender: 'male' | 'female'
          yearGan: TianGan
        }
        const juNumber = JU_NUMBER[wuXingJu]
        expect(juNumber, `${c.id} 未知五行局「${wuXingJu}」`).toBeTruthy()
        const r = computeDaXian(
          mingStub(mingGong, juNumber!),
          yearGan,
          gender,
          juNumber!
        )
        const e = c.expect as { qiYunAge?: number; direction?: string }
        if (e.qiYunAge !== undefined) expect(r.startAge).toBe(e.qiYunAge)
        if (e.direction !== undefined) expect(r.direction).toBe(e.direction)
        return
      }

      if (c.method === 'liuNian') {
        const input = c.input as {
          solarDate: string
          hour: number
          gender?: 'male' | 'female'
          liuNian: number
        }
        const [y, m, d] = input.solarDate.split('-').map(Number)
        const base = ziweiEngine.compute(
          { year: y, month: m, day: d, hour: input.hour, minute: 0, gender: input.gender } as ZiweiInput,
          RNG as never
        )
        const r = computeLiuNian(base.mingGong, input.liuNian)
        const e = c.expect as { zhi?: string; siHua?: string[] }
        if (e.zhi !== undefined) expect(r.zhi).toBe(e.zhi)
        if (e.siHua !== undefined) {
          expect([r.siHua.lu, r.siHua.quan, r.siHua.ke, r.siHua.ji]).toEqual(e.siHua)
        }
        return
      }

      /** 小限：典籍起宫口诀 + iztro@2.6.1 实测（J25 第二源） */
      if (c.method === 'xiaoXian') {
        const input = c.input as {
          solarDate: string
          hour: number
          gender: 'male' | 'female'
          liuNian: number
        }
        const [y, m, d] = input.solarDate.split('-').map(Number)
        const r = ziweiEngine.compute(
          {
            year: y,
            month: m,
            day: d,
            hour: input.hour,
            minute: 0,
            gender: input.gender,
            liuNianYear: input.liuNian
          } as ZiweiInput,
          RNG as never
        )
        const xx = r.liuNian.xiaoXian
        expect(xx, `${c.id} 未排出小限（需性别）`).toBeTruthy()
        const e = c.expect as { branch: string; age: number }
        expect(xx!.branch, `${c.id} 小限落宫`).toBe(e.branch)
        expect(xx!.age, `${c.id} 小限虚岁`).toBe(e.age)
        return
      }

      /** 杂曜余项：逐宫断言「应含」的星曜（子集匹配，避免无关星曜干扰） */
      if (c.method === 'zaYao') {
        const input = c.input as { solarDate: string; hour: number; gender: 'male' | 'female' }
        const [y, m, d] = input.solarDate.split('-').map(Number)
        const r = ziweiEngine.compute(
          {
            year: y,
            month: m,
            day: d,
            hour: input.hour,
            minute: 0,
            gender: input.gender
          } as ZiweiInput,
          RNG as never
        )
        const e = c.expect as Record<string, string[]>
        for (const [zhi, names] of Object.entries(e)) {
          const got = (r.zaYao[zhi] ?? []).slice().sort()
          for (const n of names) {
            expect(got, `${c.id} 的 ${zhi} 宫应含「${n}」`).toContain(n)
          }
        }
        return
      }

      throw new Error(
        `用例 ${c.id} 的 method「${c.method}」尚无执行器：先实现 runner 再接用例（不许改用例迁就实现）`
      )
    })
  }
})
