import { describe, it, expect } from 'vitest'
import { loadGoldenSuite } from './helpers'
import { dingJu, qimenChaibuEngine } from '@/engine/qimen'
import type { DateTimeInput } from '@/engine/calendar'

/**
 * 奇门 golden（Y0-04 / Y6-08）
 *
 * 纪律（同 `calendar.spec.ts` / `ziwei.spec.ts`）：
 * - `todo: true` 显式 pending 并计数，不用 skip 静默跳过；
 * - 期望值来自「拆补法规则独立推导 × taibu-core@3.5.0」，不得由本项目引擎反推；
 * - **先实现 runner 再接用例**，不许改用例迁就实现。
 *
 * ⚠️ J6 已拍板**拆补法**：置闰 / 茅山用例不得与本批混用。
 */
const suite = loadGoldenSuite('qimen')

describe('奇门 golden（Y6-08）', () => {
  const todoCount = suite.cases.filter((c) => c.todo).length
  const readyCount = suite.cases.length - todoCount

  it('数据集结构完整（5 组，含来源声明）', () => {
    expect(suite.cases).toHaveLength(5)
    for (const c of suite.cases) {
      expect(c.source, `${c.id} 缺 source`).toBeTruthy()
    }
  })

  it('定局法字面一致（J6：拆补法）', () => {
    expect((suite as unknown as { school?: string }).school).toBe('拆补法')
    for (const c of suite.cases) expect(c.school).toBe('拆补法')
  })

  it('缺口可见：未采集用例数被统计出来（不是被跳过）', () => {
    console.log(`[golden] qimen：已入库 ${readyCount} / 待采集 ${todoCount}`)
    if (todoCount > 0) expect(todoCount).toBeGreaterThan(0)
  })

  for (const c of suite.cases) {
    if (c.todo) {
      it.todo(`[待采集] ${c.id} — ${c.note ?? c.method}`)
      continue
    }

    it(`${c.id} ${c.method} 与权威来源一致（${c.sourceKind}）`, () => {
      if (c.method === 'dingJu') {
        const input = c.input as DateTimeInput
        const r = dingJu(input)
        expect(r, `${c.id} 定局取不到值（不猜默认值）`).toBeTruthy()
        const de = c.expect as { juShu?: number; dun?: string; yuan?: string; term?: string }
        if (de.term !== undefined) expect(r!.term).toBe(de.term)
        if (de.dun !== undefined) expect(r!.dun).toBe(de.dun)
        if (de.yuan !== undefined) expect(r!.yuan).toBe(de.yuan)
        if (de.juShu !== undefined) expect(r!.ju).toBe(de.juShu)
        return
      }

      if (c.method === 'pan') {
        const result = qimenChaibuEngine.compute({ at: c.input as DateTimeInput }, { next: () => 0, int: () => 0 })
        expect(result.dingJu, `${c.id} 定局取不到值`).toBeTruthy()
        expect(result.earthlyPlate, `${c.id} 地盘取不到`).toBeTruthy()
        expect(result.pan, `${c.id} 天盘/值符值使取不到`).toBeTruthy()
        const dj = result.dingJu!
        const plate = result.earthlyPlate!
        const pan = result.pan!
        const e = c.expect as {
          juShu?: number
          dun?: string
          yuan?: string
          term?: string
          zhiFu?: { star: string; palace: number }
          zhiShi?: { door: string; palace: number }
          /** 地盘 1-9 宫天干 */
          diPan?: string[]
          /** 天盘 1-9 宫天干 */
          tianPan?: string[]
          /** 九宫全盘：`<宫序>:<星>/<门|中>/<天干>` */
          jiuGong?: string[]
          kongWang?: string
          maXing?: string
          /** 八神排布：`<宫序>:<神名|->`（中五宫为 `-`） */
          baShen?: string[]
        }
        if (e.term !== undefined) expect(dj.term).toBe(e.term)
        if (e.dun !== undefined) expect(dj.dun).toBe(e.dun)
        if (e.yuan !== undefined) expect(dj.yuan).toBe(e.yuan)
        if (e.juShu !== undefined) expect(dj.ju).toBe(e.juShu)
        if (e.zhiFu !== undefined) {
          expect(pan.zhiFu.star, `${c.id} 值符星`).toBe(e.zhiFu.star)
          expect(pan.zhiFu.palace, `${c.id} 值符落宫`).toBe(e.zhiFu.palace)
        }
        if (e.zhiShi !== undefined) {
          expect(pan.zhiShi.door, `${c.id} 值使门`).toBe(e.zhiShi.door)
          expect(pan.zhiShi.palace, `${c.id} 值使落宫`).toBe(e.zhiShi.palace)
        }
        if (e.diPan) expect(Object.values(plate.cells), `${c.id} 地盘`).toEqual(e.diPan)
        if (e.tianPan) expect(Object.values(pan.heavenlyGan), `${c.id} 天盘`).toEqual(e.tianPan)
        if (e.jiuGong) {
          const stars = pan.stars as Record<number, string>
          const heavens = pan.heavenlyGan as Record<number, string>
          const doors = pan.doors as Record<number, string | null>
          const got = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
            const st = stars[i]
            const dr = doors[i] ?? '中'
            return `${i}:${st}/${dr}/${heavens[i]}`
          })
          expect(got, `${c.id} 九宫全盘`).toEqual(e.jiuGong)
        }
        if (e.kongWang !== undefined)
          expect(pan.kongWang.join(''), `${c.id} 空亡`).toBe(e.kongWang)
        if (e.maXing !== undefined) expect(pan.maXing, `${c.id} 驿马`).toBe(e.maXing)
        // 八神（J21 决议：采通行次序 值符·螣蛇·太阴·六合·白虎·玄武·九地·九天，阳顺阴逆）
        if (e.baShen) {
          const got = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(
            (i) => `${i}:${pan.gods[i as 1] ?? '-'}`
          )
          expect(got, `${c.id} 八神排布`).toEqual(e.baShen)
        }
        return
      }

      throw new Error(
        `用例 ${c.id} 的 method「${c.method}」尚无执行器：先实现 runner 再接用例（不许改用例迁就实现）`
      )
    })
  }
})
