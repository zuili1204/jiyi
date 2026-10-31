import type { NaJiaResult } from './naJia'
import type { WangShuaiResult } from './wangShuai'

/**
 * 六爻判读（Y3-10，内容母版过渡期的**初版断语参照层**）
 *
 * 体系：判词/强度词直接引用 taibu-master `packages/core/src/domains/liuyao`（MIT）
 * 的判读标签（旺衰、暗动/日破/月破、用神强度 `旺相可取/平常可参/衰弱受制` 等）——
 * **不凭空造措辞**，每条都可追溯到 taibu 枚举；且已由 taibu-core 运行时实测佐证
 * （见 `DOCS/golden/taibu-liuyao.json`，`tests/iching-taibu-golden.spec.ts` 锁定）。
 *
 * ⚠️ 硬边界：
 * - 这是「参考判读」而非权威断语：`reviewed:false`、`source='taibu(参考)'`，
 *   结果页必须带「待核验」可见，不污染 `wangShuai` / `naJia` 的排盘结构结论。
 * - golden 就绪后（需换 source）才可升级，不得据本层推翻排盘。
 */

export const VERDICT_SOURCE = 'taibu 六爻判读标签（参考，Y3-10 中）'
export const VERDICT_REVIEWED = false

/**
 * taibu 用神强度三词（yongShen.selected.strengthLabel 实测词集，与 golden 逐字一致）。
 * 按项目旺衰 level 映射：旺→旺相可取、平→平常可参、衰→衰弱受制。
 */
const STRENGTH_LABEL: Record<'旺' | '衰' | '平', string> = {
  旺: '旺相可取',
  平: '平常可参',
  衰: '衰弱受制'
}

export interface VerdictLine {
  position: number
  zhi: string
  liuQin: string
  /** 世 / 应 / 动 / 静 */
  role: string
  /** 旺衰 + 特殊态标签 */
  tags: string[]
  /** taibu 判读短语（一句话，可计入结果页） */
  phrase: string
}

export interface VerdictResult {
  lines: VerdictLine[]
  /** 动爻位置列表（应期主轴） */
  dongYao: number[]
  reviewed: boolean
  source: string
}

export function liuYaoVerdict(najia: NaJiaResult, wangshuai: WangShuaiResult): VerdictResult {
  const najiaByPos = new Map(najia.yao.map((y) => [y.position, y]))
  const lines: VerdictLine[] = []
  const dongYao: number[] = []

  for (const y of wangshuai.yao) {
    const n = najiaByPos.get(y.position)
    const moving = n?.moving
    const shi = !!n?.shi
    const ying = !!n?.ying
    if (moving) dongYao.push(y.position)

    const tags: string[] = [y.level]
    if (y.yuePo) tags.push('月破')
    if (y.riChong === '暗动') tags.push('暗动')
    if (y.riChong === '日破') tags.push('日破')
    if (y.kongWang) tags.push('旬空')
    if (moving) tags.push('动')

    const role = shi ? '世' : ying ? '应' : ''
    // 只用 taibu 判读词，不额外演绎吉凶：世/应爻给强度词，其余给状态
    const label = shi || ying ? STRENGTH_LABEL[y.level] : `${y.level}状态`
    const phrase = `${y.position}爻${y.liuQin}${role ? `（${role}）` : ''}：${tags.join('·')}，${label}`
    lines.push({ position: y.position, zhi: y.zhi, liuQin: y.liuQin, role, tags, phrase })
  }

  return { lines, dongYao, reviewed: VERDICT_REVIEWED, source: VERDICT_SOURCE }
}