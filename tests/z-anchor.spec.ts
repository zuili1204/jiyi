import { expect, test } from 'vitest'
import {
  fourPillars,
  lunarYearToSolar,
  type DateTimeInput
} from '../src/engine/calendar/index'

/**
 * Z-锚：《奇门旨归》卷三十八《占验课》25 例公历锚点回归（golden）
 *
 * 只锚「年干支 + 农历月日 → 唯一公历」。别给农历断言（其 1900 前为库规则，
 * 非权威），唯一性命中即以为锚；日柱用 fourPillars 派生作第二参照、不硬断言誊录。
 */
interface ZAnchor {
  id: string
  yearGZ: string
  month: number
  day: number
  expect: [number, number, number] // 公历年/月/日
}

// expect 值来自 scripts/anchor-zhanguo.mts 实测（vite-node）
const ANCHORS: ZAnchor[] = [
  { id: 'Z01', yearGZ: '癸丑', month: 9,  day: 3,  expect: [1853, 10, 5]  },
  { id: 'Z02', yearGZ: '乙卯', month: 5,  day: 9,  expect: [1855, 6, 22]  },
  { id: 'Z03', yearGZ: '乙亥', month: 12, day: 17, expect: [1876, 1, 13]  },
  { id: 'Z04', yearGZ: '丙子', month: 1,  day: 14, expect: [1876, 2, 8]   },
  { id: 'Z05', yearGZ: '丙子', month: 1,  day: 21, expect: [1876, 2, 15]  },
  { id: 'Z06', yearGZ: '丙子', month: 1,  day: 22, expect: [1876, 2, 16]  },
  { id: 'Z07', yearGZ: '甲申', month: 4,  day: 4,  expect: [1884, 4, 28]  },
  { id: 'Z08', yearGZ: '甲申', month: 4,  day: 4,  expect: [1884, 4, 28]  },
  { id: 'Z09', yearGZ: '甲申', month: 4,  day: 2,  expect: [1884, 4, 26]  },
  { id: 'Z10', yearGZ: '甲申', month: 11, day: 3,  expect: [1884, 12, 19] },
  { id: 'Z11', yearGZ: '乙酉', month: 1,  day: 30, expect: [1885, 3, 16]  },
  { id: 'Z12', yearGZ: '乙酉', month: 2,  day: 3,  expect: [1885, 3, 19]  },
  { id: 'Z13', yearGZ: '丙戌', month: 9,  day: 16, expect: [1886, 10, 13] },
  { id: 'Z14', yearGZ: '丁亥', month: 4,  day: 17, expect: [1887, 5, 9]   },
  { id: 'Z15', yearGZ: '丁亥', month: -4, day: 8,  expect: [1887, 5, 30]  },
  { id: 'Z16', yearGZ: '戊子', month: 9,  day: 3,  expect: [1888, 10, 7]  },
  { id: 'Z17', yearGZ: '戊子', month: 9,  day: 7,  expect: [1888, 10, 11] },
  { id: 'Z18', yearGZ: '己丑', month: 3,  day: 7,  expect: [1889, 4, 6]   },
  { id: 'Z19', yearGZ: '庚寅', month: 10, day: 1,  expect: [1890, 11, 12] },
  { id: 'Z20', yearGZ: '庚寅', month: 12, day: 4,  expect: [1891, 1, 13]  },
  { id: 'Z21', yearGZ: '壬辰', month: 7,  day: 7,  expect: [1892, 8, 28]  },
  { id: 'Z22', yearGZ: '壬辰', month: 7,  day: 9,  expect: [1892, 8, 30]  },
  { id: 'Z23', yearGZ: '乙酉', month: 8,  day: 8,  expect: [1885, 9, 16]  },
  { id: 'Z24', yearGZ: '乙酉', month: 3,  day: 20, expect: [1885, 5, 4]   },
  { id: 'Z25', yearGZ: '庚辰', month: 9,  day: 14, expect: [1880, 10, 17] }
]

test.each(ANCHORS)('$id 公历锚点', ({ id, yearGZ, month, day, expect: e }) => {
  const hits = lunarYearToSolar(yearGZ, month, day, 1850, 1900)
  // 唯一性命中：窗口内仅一个「该农历年干支 ∧ 月 ∧ 日」
  expect(hits.length, `${id}: 应恰一个候选`).toBe(1)
  expect([hits[0].year, hits[0].month, hits[0].day]).toEqual([e[0], e[1], e[2]])

  // 参照：该公历下的实测日柱（不硬断言，仅保证引擎可算满四柱）
  const d0: DateTimeInput = { year: hits[0].year, month: hits[0].month, day: hits[0].day, hour: 12, minute: 0 }
  expect(() => fourPillars(d0)).not.toThrow()
})