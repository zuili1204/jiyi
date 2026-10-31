import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { determineMingGong } from '@/engine/ziwei/palace'
import { computeSiHua } from '@/engine/ziwei/siHua'
import { ziweiEngine } from '@/engine/ziwei'
import type { TianGan } from '@/engine/calendar'

/**
 * 紫微 自研引擎 × iztro(2.6.1) 交叉对拍（来源1 侧自建，非 golden 判定）
 *
 * 目标：
 *  - A) 自研现行「公历月」跑命宫 → 与 iztro 比，量化月口径偏移；
 *  - B) 把 iztro 的「农历月」喂给自研 determineMingGong → 若命宫支==iztro，
 *        证明差异纯粹来自月口径、安星算法本身吻合；
 *  - 并比五行局与生年四化。
 */

type Sup = { name: string; type: string; mutagen: string | null; brightness?: string }
type IzRow = {
  date?: string
  lunar?: string
  chinese?: string
  time?: string
  soulPalace?: string
  fiveElementsClass?: string
  palaces?: { name: string; branch: string; super: Sup[] }[]
}

/** 对拍数据来自本地第三方参考资料（.gitignore 不入库）：全新克隆 / CI 无此文件时整组跳过 */
const DUMP_PATH = resolve(process.cwd(), 'DOCS/iztro-main/iztro-main/ziwei-dump-full.json')
const hasDump = existsSync(DUMP_PATH)
const dump = (hasDump ? JSON.parse(readFileSync(DUMP_PATH, 'utf8')) : {}) as Record<string, IzRow>

const GENDER: Record<string, 'male' | 'female'> = {
  'ziwei-001': 'male',
  'ziwei-002': 'female',
  'ziwei-003': 'male',
  'ziwei-004': 'female',
  'ziwei-009': 'male',
  'ziwei-010': 'male',
  'user-2000-02-09': 'female',
}

const TIME_HOUR: Record<string, number> = {
  早子时: 0, 丑时: 2, 寅时: 4, 卯时: 6, 辰时: 8, 巳时: 10,
  午时: 12, 未时: 14, 申时: 16, 酉时: 18, 戌时: 20, 亥时: 22, 晚子时: 23,
}
const MONTH_CN: Record<string, number> = {
  正: 1, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6,
  七: 7, 八: 8, 九: 9, 十: 10, 冬: 11, 腊: 12,
}
function lunarMonth(lunar?: string): number {
  return MONTH_CN[(lunar?.split('年')[1] ?? '正')[0]] ?? 0
}
function yearGan(chinese?: string): TianGan {
  return (chinese ?? ' ').split(' ')[0][0] as TianGan
}
function iztroSiHua(row: IzRow): Record<string, { star: string; branch: string }> {
  const found: Record<string, { star: string; branch: string }> = {}
  for (const p of row.palaces ?? []) {
    for (const s of p.super) {
      if (s.mutagen) found[s.mutagen] = { star: s.name, branch: p.branch }
    }
  }
  return found
}

(hasDump ? describe : describe.skip)('ziwei 自研 × iztro 对拍', () => {
  it('公历 vs 农历月 → 命宫 / 五行局 / 四化', () => {
    const lines: string[] = []
    for (const [id, row] of Object.entries(dump)) {
      if (!row.date || !row.chinese) continue
      const [y, m, d] = row.date.split('-').map(Number)
      const hour = TIME_HOUR[row.time ?? ''] ?? 0
      const yG = yearGan(row.chinese)
      const lMonth = lunarMonth(row.lunar)

      // 引擎 compute 是确定性计算，随机源传空实现（签名要求的第二参）
      const nowR = ziweiEngine.compute(
        { year: y, month: m, day: d, hour, minute: 0, gender: GENDER[id] },
        { next: () => 0, int: () => 0 }
      )
      const mNow = nowR.mingGong.branch
      const wuNow = nowR.mingGong.wuXingJu.label

      const mB = determineMingGong(yG, lMonth, hour)
      const mIZ = row.soulPalace ?? '?'

      const flagNow = mNow === mIZ ? '✓' : '✗'
      const wuIZ = row.fiveElementsClass ?? '?'
      const wuNowFlag = wuNow === wuIZ ? '✓' : '✗'

      // 引擎已改为农历口径：compute 命宫 / 五行局应直接命中 iztro（回归断言）
      expect(mNow, `[${id}] 命宫应==iztro`).toBe(mIZ)
      expect(wuNow, `[${id}] 五行局应==iztro`).toBe(wuIZ)
      // 对照组：农历月喂 determineMingGong 亦应吻合（验证安星公式与 iztro 一致）
      expect(mB.branch, `[${id}] 农历月命宫应==iztro`).toBe(mIZ)

      const s = computeSiHua(yG)
      const izHua = iztroSiHua(row)

      lines.push(
        `\n[${id}] ${row.date} ${row.time} 年干${yG} 农历月${lMonth}`,
        `  命宫   compute=${mNow}  农历月=${mB.branch}  iztro=${mIZ}  命中 ${flagNow}`,
        `  五行局 compute=${wuNow}   iztro=${wuIZ}   ${wuNowFlag}`,
        `  四化   self=禄${s.lu} 权${s.quan} 科${s.ke} 忌${s.ji}`,
        `         iztro=禄:${izHua['禄']?.star ?? '-'}/${izHua['禄']?.branch ?? '-'}  权:${izHua['权']?.star ?? '-'}  科:${izHua['科']?.star ?? '-'}  忌:${izHua['忌']?.star ?? '-'}`
      )
    }
    console.log(lines.join('\n'))
  })
})