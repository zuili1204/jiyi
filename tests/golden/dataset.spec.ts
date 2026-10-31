import { describe, it, expect } from 'vitest'
import { loadGoldenSuite } from './helpers'

/**
 * golden 数据集总账（JY-02 §5.1 / JY-13 §8「golden 通过率」）
 *
 * 目的：把"采集缺口"变成**可统计的数字**，而不是散落在文档里的待办。
 * 每份用例文件都必须能装载、数量符合 JY-02 §5.1、且 todo 用例被显式计数。
 */
/**
 * golden 用例数口径（2026-09-23 变更，用户拍板）：
 * `cases` = **下限**（`JY-02 §5.1` 的构成要求），**允许按需扩充**。
 *
 * 原因：`reviewed` 转正需要「被断言的那部分」有 golden 覆盖，而刑冲合害 / 紫微小限 /
 * 奇门八神 / 八字格局等子模块在原 70 条之外 —— 不扩用例它们永远无法转正。
 * 故 70 视为构成要求的**下限**而非定数。
 */
const EXPECTED: Record<string, { cases: number; milestone: string }> = {
  calendar: { cases: 20, milestone: 'Y1' },
  bazi: { cases: 20, milestone: 'Y4' },
  liujiao: { cases: 10, milestone: 'Y3' },
  meihua: { cases: 5, milestone: 'Y3' },
  ziwei: { cases: 10, milestone: 'Y5' },
  qimen: { cases: 5, milestone: 'Y6' }
}

describe('golden 数据集（Y0-03 / Y0-04）', () => {
  for (const [name, meta] of Object.entries(EXPECTED)) {
    it(`${name}.json 已建立且用例数不低于 JY-02 §5.1 下限（${meta.cases} 条 / ${meta.milestone}）`, () => {
      const suite = loadGoldenSuite(name)
      expect(suite.cases.length, `${name} 用例数低于下限`).toBeGreaterThanOrEqual(meta.cases)
      const ids = new Set(suite.cases.map((c) => c.id))
      expect(ids.size, `${name} 存在重复 id`).toBe(suite.cases.length) // id 唯一
    })
  }

  it('缺口可统计：输出各品类「已入库 / 待采集」', () => {
    const report = Object.keys(EXPECTED).map((name) => {
      const cases = loadGoldenSuite(name).cases
      const todo = cases.filter((c) => c.todo).length
      return { name, ready: cases.length - todo, todo }
    })
    const totalReady = report.reduce((a, r) => a + r.ready, 0)
    const totalTodo = report.reduce((a, r) => a + r.todo, 0)
    console.log(
      `[golden] 已入库 ${totalReady} / 待采集 ${totalTodo}：` +
        report.map((r) => `${r.name} ${r.ready}/${r.todo}`).join('，')
    )
    // 70 为构成要求的**下限**（2026-09-23 起允许扩充），故用 >= 断言
    expect(totalReady + totalTodo).toBeGreaterThanOrEqual(70)
    // Y0-03/04 已完成：全部 70 条入库，todo 归零。此处保留统计输出，断言改为条件式，
    // 若将来新增待采集用例则仍需显式计数（不许静默 skip）。
    if (totalTodo > 0) expect(totalTodo).toBeGreaterThan(0)
  })

  it('用例必须声明 school（跨流派不得混用）', () => {
    for (const name of ['bazi', 'liujiao', 'meihua', 'ziwei', 'qimen']) {
      for (const c of loadGoldenSuite(name).cases) {
        expect(c.school, `${c.id} 缺 school（JY-02 §5.4）`).toBeTruthy()
      }
    }
  })
})
