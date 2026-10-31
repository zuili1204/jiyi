import type { DiZhi, TianGan } from '@/engine/calendar'
import type { Palace } from './earthlyPlate'
import type { Dun } from './constants'

/**
 * 奇门口径参照（Y6-09 资料补齐）
 *
 * 把从权威资料摘出的口径固化为「可核校的锚点」，供排盘实现 / 测试 / 文档对照，
 * 不写入任何局数与吉凶断语。资料来源与状态：
 *
 * - **yjhome.com/qimen 奇门基础**（含《烟波钓叟歌》核心口诀）：
 *   - 地盘「阳遁顺仪奇逆布，阴遁逆仪奇顺行」→ 与 `earthlyPlate.ts` 的 `QI_YI_YANG/YIN` 一致；
 *   - 值符「直符常遣加时干」（值符星随时干落宫）→ 与 `pan.ts` 第②步一致；
 *   - 值使「直使随时支、逆顺遁宫去」→ 与 `pan.ts` 第⑤步一致；
 *   - 九星 / 八门所属宫位 → 与 `pan.ts` 的 `STAR_BY_PALACE` / `DOOR_BY_PALACE` 一致。
 * - **转盘奇口通行**：空亡取时旬（六甲空）、驿马取时支；星 / 门 / 神不并入中五宫。
 *
 * ⚠️ **待 golden 定夺的流派分支**（`pan.ts` 已在 `notes` 里如实标注，不静默选择）：
 *  - 天盘九星旋转按「地盘洛书数序」顺逆（转盘派）——本实现采用；
 *  - 天禽星居中五宫（亦有寄坤二宫之说）；
 *  - 星 / 门落中宫时的寄宫：通行记「阳遁寄坤2、阴遁寄艮8」，本实现暂统一寄坤2；
 *  - 局数母版（`DOCS/content/qimen/dingJu.json`）局数表（24×3）已三重对账（reviewed=true）；盘面取法仍待 golden（Y6-08）。
 *
 * 纪律：本模块是**口径档案**，不是执行逻辑；`reviewed` 转正仍需 golden 样例，禁止无据宣称正确。
 */

/** 地盘阳遁干序（六仪在前、三奇在后；阳遁顺布）——古歌「阳遁顺仪奇逆布」 */
export const EARTH_YANG_ORDER: TianGan[] = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙']
/** 地盘阴遁干序（逆行）—— 「阴遁逆仪奇顺行」 */
export const EARTH_YIN_ORDER: TianGan[] = ['戊', '乙', '丙', '丁', '癸', '壬', '辛', '庚', '己']

/** 六仪（六甲遁支） */
export const LIU_YI: Record<string, string> = {
  甲子: '戊', 甲戌: '己', 甲申: '庚',
  甲午: '辛', 甲辰: '壬', 甲寅: '癸'
}
/** 三奇：乙丙丁 */
export const SAN_QI: TianGan[] = ['乙', '丙', '丁']

/** 九星（洛书宫序）五行 / 吉凶 —— yjhome 九星表 */
export const STAR_META: Record<string, { palace: Palace; wuXing: string; ji: '吉' | '凶' | '小吉' | '小凶' | '大吉' | '大凶' }> = {
  天蓬: { palace: 1, wuXing: '水', ji: '大凶' },
  天芮: { palace: 2, wuXing: '土', ji: '大凶' },
  天冲: { palace: 3, wuXing: '木', ji: '小吉' },
  天辅: { palace: 4, wuXing: '木', ji: '大吉' },
  天禽: { palace: 5, wuXing: '土', ji: '大吉' },
  天心: { palace: 6, wuXing: '金', ji: '大吉' },
  天柱: { palace: 7, wuXing: '金', ji: '小凶' },
  天任: { palace: 8, wuXing: '土', ji: '小吉' },
  天英: { palace: 9, wuXing: '火', ji: '小凶' }
}

/** 八门属宫（中五无门，寄坤二） */
export const DOOR_META: Record<string, { palace: Palace | null; wuXing: string; ji: '吉' | '凶' | '平' }> = {
  休: { palace: 1, wuXing: '水', ji: '吉' },
  死: { palace: 2, wuXing: '土', ji: '凶' },
  伤: { palace: 3, wuXing: '木', ji: '凶' },
  杜: { palace: 4, wuXing: '木', ji: '平' },
  开: { palace: 6, wuXing: '金', ji: '吉' },
  惊: { palace: 7, wuXing: '金', ji: '凶' },
  生: { palace: 8, wuXing: '土', ji: '吉' },
  景: { palace: 9, wuXing: '火', ji: '平' }
}

/** 值符星 / 值使门落宫中，若恰算到中五宫时的寄宫：阳遁寄坤2、阴遁寄艮8（流派分支，先记战不分） */
export const zhONG_GONG_QI: Record<Dun, Palace> = { yang: 2, yin: 8 }

/** 十二支 → 洛书宫（与 `pan.ts` 的 ZHI_PALACE 一致，供参照） */
export const DI_ZHI_LUOSHU: Record<DiZhi, Palace> = {
  子: 1, 丑: 8, 寅: 8, 卯: 3, 辰: 4, 巳: 4,
  午: 9, 未: 2, 申: 2, 酉: 7, 戌: 6, 亥: 6
}

/** 资料出处（供界面 / 文档可见，不做断言） */
export const QIMEN_REFERENCE_SOURCE =
  '《烟波钓叟歌》与转盘奇门通行口径（yjhome/奇门基础等）：地盘顺逆见本文件口诀；九星/八门宫位、值符加时干、值使随支见排盘实现。'