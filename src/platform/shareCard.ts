import type { Interpretation } from '@/engine/types'

/**
 * 分享图版式 A（Y2-07）：签占结果卡片
 *
 * 硬约束（JY-04 §4 / YR19）：
 * - **只从 `Interpretation` 取内容**，不接受任何 `input` —— 结构上不可能把用户
 *   输入的「心中所问」或出生数据画进图里（分享图泄露 PII 是同类产品常见事故）。
 * - 图上必须常驻免责声明（`SHARE_DISCLAIMER`）。
 * - 必须画出内容出处（source / school），否则属无源内容。
 *
 * 可测性：绘制逻辑拆成 `layoutShareCard`（纯数据）+ `drawShareCard`（只依赖
 * `CanvasRenderingContext2D` 接口），测试用桩 ctx 即可断言，无需真实 canvas。
 */

export const SHARE_BRAND = '稽疑 JiYi'
export const SHARE_DISCLAIMER = '结果仅供参考，不构成任何决策建议；命运在己，慎思笃行。'

/** 版面字号（px，按 750 宽设计稿） */
export const SHARE_FONT = {
  brand: 24,
  title: 44,
  body: 30,
  meta: 22
} as const

export interface ShareCardLayout {
  brand: string
  title: string
  /** 签诗 / 解曰正文行（已换行、已截断） */
  lines: string[]
  source?: string
  school?: string
  disclaimer: string
}

export interface LayoutOptions {
  /** 正文最多行数（超出截断，避免文字溢出卡片） */
  maxLines?: number
  /** 解曰最多字符数 */
  maxProse?: number
}

export const DEFAULT_LAYOUT: Required<LayoutOptions> = { maxLines: 12, maxProse: 160 }

function truncate(text: string, max: number): string {
  const t = text.trim()
  return t.length > max ? `${t.slice(0, max)}…` : t
}

/**
 * 由解读结果生成版面数据（纯函数，可单测）。
 * 只取 interpretation 的 title / poem / prose / source / school，不含任何用户输入。
 */
export function layoutShareCard(
  interp: Interpretation,
  opts: LayoutOptions = {}
): ShareCardLayout {
  const o = { ...DEFAULT_LAYOUT, ...opts }
  const pick = (key: string) => interp.blocks.find((b) => b.key === key)?.text

  const poem = pick('poem') ?? ''
  const prose = pick('prose') ?? interp.summary ?? ''

  const lines: string[] = []
  for (const l of poem.split('\n')) {
    const t = l.trim()
    if (t) lines.push(t)
  }
  if (prose.trim()) lines.push(truncate(prose, o.maxProse))

  return {
    brand: SHARE_BRAND,
    title: interp.title,
    lines: lines.slice(0, o.maxLines),
    source: interp.source,
    school: interp.school && interp.school !== 'none' ? interp.school : undefined,
    disclaimer: SHARE_DISCLAIMER
  }
}

/** 绘图上下文最小接口（便于注入桩对象做单测） */
export interface Ctx2D {
  canvas?: { width: number; height: number }
  fillStyle: string | object
  font: string
  textAlign: string
  textBaseline: string
  fillRect(x: number, y: number, w: number, h: number): void
  fillText(text: string, x: number, y: number): void
  measureText(text: string): { width: number }
}

export const SHARE_CARD_WIDTH = 750
export const SHARE_CARD_HEIGHT = 1100
const PADDING = 56

function wrap(ctx: Ctx2D, text: string, maxWidth: number): string[] {
  const out: string[] = []
  let cur = ''
  for (const ch of text) {
    if (ch === '\n') {
      out.push(cur)
      cur = ''
      continue
    }
    const next = cur + ch
    if (cur && ctx.measureText(next).width > maxWidth) {
      out.push(cur)
      cur = ch
    } else {
      cur = next
    }
  }
  if (cur) out.push(cur)
  return out
}

export interface DrawOptions {
  width?: number
  height?: number
  padding?: number
  /** 测试用：记录实际绘制的文本 */
  onText?: (text: string) => void
}

/** 把版面画到给定 ctx；不创建 canvas，纯绘制 */
export function drawShareCard(ctx: Ctx2D, layout: ShareCardLayout, opts: DrawOptions = {}): void {
  const width = opts.width ?? SHARE_CARD_WIDTH
  const height = opts.height ?? SHARE_CARD_HEIGHT
  const padding = opts.padding ?? PADDING
  const maxWidth = width - padding * 2
  const emit = (t: string, x: number, yPos: number) => {
    ctx.fillText(t, x, yPos)
    opts.onText?.(t)
  }

  // 背景 + 卡片
  ctx.fillStyle = '#0e0d12'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#17151d'
  ctx.fillRect(padding / 2, padding / 2, width - padding, height - padding)

  let y = padding + 40
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  // 免责先算行数：常驻底部（首行基线即 footTop），正文不得压过它
  ctx.font = `${SHARE_FONT.meta}px sans-serif`
  const footLines = wrap(ctx, layout.disclaimer, maxWidth)
  const footLineH = SHARE_FONT.meta + 10
  const footTop = height - padding - (footLines.length - 1) * footLineH

  ctx.fillStyle = '#9a93a6'
  ctx.font = `${SHARE_FONT.brand}px sans-serif`
  emit(layout.brand, padding, y)
  y += 28

  ctx.fillStyle = '#ece8f1'
  ctx.font = `${SHARE_FONT.title}px sans-serif`
  for (const line of wrap(ctx, layout.title, maxWidth)) {
    emit(line, padding, y)
    y += SHARE_FONT.title + 12
  }
  y += 20

  ctx.fillStyle = '#ece8f1'
  ctx.font = `${SHARE_FONT.body}px sans-serif`
  for (const raw of layout.lines) {
    for (const line of wrap(ctx, raw, maxWidth)) {
      if (y >= footTop - SHARE_FONT.body) break
      emit(line, padding, y)
      y += SHARE_FONT.body + 14
    }
    y += 8
  }

  // 出处 / 流派（无源内容不上图）
  if (layout.source || layout.school) {
    ctx.fillStyle = '#9a93a6'
    ctx.font = `${SHARE_FONT.meta}px sans-serif`
    const meta = [layout.source, layout.school].filter(Boolean).join(' · ')
    for (const line of wrap(ctx, meta, maxWidth)) {
      if (y >= footTop - SHARE_FONT.meta) break
      emit(line, padding, y)
      y += SHARE_FONT.meta + 10
    }
  }

  // 免责常驻底部
  ctx.fillStyle = '#9a93a6'
  ctx.font = `${SHARE_FONT.meta}px sans-serif`
  let fy = footTop
  for (const line of footLines) {
    emit(line, padding, fy)
    fy += footLineH
  }
}

/** 生成分享图 dataURL；环境无 canvas 时返回 null（由调用方降级，不抛错） */
export function buildShareCard(interp: Interpretation, opts: LayoutOptions = {}): string | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = SHARE_CARD_WIDTH
  canvas.height = SHARE_CARD_HEIGHT
  const ctx = canvas.getContext('2d') as unknown as Ctx2D | null
  if (!ctx || typeof ctx.fillText !== 'function') return null
  drawShareCard(ctx, layoutShareCard(interp, opts))
  return canvas.toDataURL('image/png')
}

// ---------------------------------------------------------------- 版式 B：卦版（Y3-12）

export interface HexagramShare {
  index: number
  name: string
  upper: string
  lower: string
}

export interface ShareCardLayoutB {
  brand: string
  title: string
  /** 自下而上六爻；渲染时自上而下（上爻在最上） */
  lines: boolean[]
  /** 动爻位（1–6，自下而上） */
  dongYao: number[]
  /** 「之卦」文本；无动爻时为空 */
  changed?: string
  source?: string
  school?: string
  disclaimer: string
}

/**
 * 由解读结果还原卦象结构（Y3-12）。
 *
 * 数据来源是 `Interpretation.basis` —— 即引擎随记录落库的「排盘依据」（JY-02 §7），
 * 仍然**只接受 Interpretation**，不碰任何用户输入（与版式 A 同一条 PII 纪律）。
 * 取不到卦象结构时返回 null（调用方退回版式 A），不猜。
 */
export function hexagramShareFromInterpretation(
  interp: Interpretation
): ShareCardLayoutB | null {
  const b = (interp.basis ?? {}) as Record<string, unknown>
  const ben = b['benGua'] as HexagramShare | undefined
  const lines = b['lines'] as boolean[] | undefined
  if (!ben || !Array.isArray(lines) || lines.length !== 6) return null

  const dongYao = Array.isArray(b['dongYao']) ? (b['dongYao'] as number[]) : []
  const bian = b['bianGua'] as HexagramShare | undefined
  const school = interp.school && interp.school !== 'none' ? interp.school : undefined

  return {
    brand: SHARE_BRAND,
    title: `第 ${ben.index} 卦 · ${ben.name}（上${ben.upper}下${ben.lower}）`,
    lines,
    dongYao,
    changed: bian ? `之卦：第 ${bian.index} 卦 ${bian.name}` : undefined,
    source: interp.source,
    school,
    disclaimer: SHARE_DISCLAIMER
  }
}

/** 动爻标记：老阳 ○、老阴 ×（其余不标） */
export function movingMark(yang: boolean): string {
  return yang ? '○' : '×'
}

/** 绘制版式 B：卦象（六爻，阳一画 / 阴两画）+ 动爻标记 + 之卦 + 免责 */
export function drawShareCardB(ctx: Ctx2D, layout: ShareCardLayoutB, opts: DrawOptions = {}): void {
  const width = opts.width ?? SHARE_CARD_WIDTH
  const height = opts.height ?? SHARE_CARD_HEIGHT
  const padding = opts.padding ?? PADDING
  const maxWidth = width - padding * 2
  const emit = (t: string, x: number, yPos: number) => {
    ctx.fillText(t, x, yPos)
    opts.onText?.(t)
  }

  ctx.fillStyle = '#0e0d12'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#17151d'
  ctx.fillRect(padding / 2, padding / 2, width - padding, height - padding)

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  let y = padding + 40
  ctx.fillStyle = '#9a93a6'
  ctx.font = `${SHARE_FONT.brand}px sans-serif`
  emit(layout.brand, padding, y)
  y += 28

  ctx.fillStyle = '#ece8f1'
  ctx.font = `${SHARE_FONT.title}px sans-serif`
  for (const line of wrap(ctx, layout.title, maxWidth)) {
    emit(line, padding, y)
    y += SHARE_FONT.title + 12
  }
  y += 24

  // 卦象：自上而下（下标 5 → 0），爻区居中
  const yaoW = Math.min(maxWidth, 420)
  const yaoX = padding + (maxWidth - yaoW) / 2
  const gap = 40
  const barH = 10
  const halfW = yaoW * 0.4
  ctx.fillStyle = '#ece8f1'
  for (let i = 5; i >= 0; i--) {
    const yang = layout.lines[i]
    const cy = y + (5 - i) * gap
    if (yang) {
      ctx.fillRect(yaoX, cy, yaoW, barH)
    } else {
      ctx.fillRect(yaoX, cy, halfW, barH)
      ctx.fillRect(yaoX + yaoW - halfW, cy, halfW, barH)
    }
    if (layout.dongYao.includes(i + 1)) emit(movingMark(yang), yaoX + yaoW + 16, cy + barH + 4)
  }
  y += 6 * gap + 20

  ctx.fillStyle = '#ece8f1'
  ctx.font = `${SHARE_FONT.body}px sans-serif`
  if (layout.changed) {
    for (const line of wrap(ctx, layout.changed, maxWidth)) {
      emit(line, padding, y)
      y += SHARE_FONT.body + 12
    }
  }
  const dongText = layout.dongYao.length
    ? `动爻：第 ${layout.dongYao.join('、')} 爻`
    : '无动爻（静卦）'
  for (const line of wrap(ctx, dongText, maxWidth)) {
    emit(line, padding, y)
    y += SHARE_FONT.body + 12
  }

  if (layout.source || layout.school) {
    ctx.fillStyle = '#9a93a6'
    ctx.font = `${SHARE_FONT.meta}px sans-serif`
    const meta = [layout.source, layout.school].filter(Boolean).join(' · ')
    for (const line of wrap(ctx, meta, maxWidth)) {
      emit(line, padding, y)
      y += SHARE_FONT.meta + 10
    }
  }

  // 免责常驻底部（首行基线即 footTop）
  ctx.fillStyle = '#9a93a6'
  ctx.font = `${SHARE_FONT.meta}px sans-serif`
  const footLines = wrap(ctx, layout.disclaimer, maxWidth)
  const footLineH = SHARE_FONT.meta + 10
  let fy = height - padding - (footLines.length - 1) * footLineH
  for (const line of footLines) {
    emit(line, padding, fy)
    fy += footLineH
  }
}

/** 生成卦版分享图 dataURL；环境无 canvas 时返回 null */
export function buildShareCardB(interp: Interpretation, opts: DrawOptions = {}): string | null {
  const layout = hexagramShareFromInterpretation(interp)
  if (!layout) return null
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = opts.width ?? SHARE_CARD_WIDTH
  canvas.height = opts.height ?? SHARE_CARD_HEIGHT
  const ctx = canvas.getContext('2d') as unknown as Ctx2D | null
  if (!ctx || typeof ctx.fillText !== 'function') return null
  drawShareCardB(ctx, layout, opts)
  return canvas.toDataURL('image/png')
}

// ---------------------------------------------------------------- 版式 C：奇门盘版（Y6-07）

export interface QimenPalaceShare {
  palace: number
  name: string
  earthlyGan: string
  heavenlyGan: string
  star: string
  door: string | null
  god: string | null
  isZhiFu: boolean
  isZhiShi: boolean
  isKong: boolean
  isMa: boolean
}

export interface ShareCardLayoutC {
  brand: string
  title: string
  /** 按洛书排布顺序的九宫（上：巽4 离9 坤2） */
  palaces: QimenPalaceShare[]
  source?: string
  school?: string
  disclaimer: string
}

/** 洛书九宫排布顺序：上 巽4·离9·坤2 ／ 中 震3·中5·兑7 ／ 下 艮8·坎1·乾6 */
export const QIMEN_GRID_ORDER = [4, 9, 2, 3, 5, 7, 8, 1, 6] as const

/**
 * 由解读结果还原九宫盘（Y6-07）。
 *
 * 与版式 A / B 同一条硬纪律：**只从 `Interpretation.basis` 取结构**，
 * 不接触 input —— 奇门 input 含「问事时刻 / 所问何事」，绝不允许进分享图（YR19）。
 * 取不到九宫结构返回 null（调用方退回版式 A），**不猜、不补空盘**。
 */
export function qimenShareFromInterpretation(interp: Interpretation): ShareCardLayoutC | null {
  const b = (interp.basis ?? {}) as Record<string, unknown>
  const raw = b['qimenPan'] as unknown
  if (!Array.isArray(raw) || raw.length !== 9) return null
  const all = raw as QimenPalaceShare[]
  const ordered: QimenPalaceShare[] = []
  for (const n of QIMEN_GRID_ORDER) {
    const hit = all.find((p) => p.palace === n)
    if (!hit) return null
    ordered.push(hit)
  }
  const school = interp.school && interp.school !== 'none' ? interp.school : undefined
  return {
    brand: SHARE_BRAND,
    title: interp.title,
    palaces: ordered,
    source: interp.source,
    school,
    disclaimer: SHARE_DISCLAIMER
  }
}

/** 绘制版式 C：九宫盘（星 / 门 / 神 / 天地盘干 + 值符值使 / 空亡 / 驿马标记）+ 免责 */
export function drawShareCardC(ctx: Ctx2D, layout: ShareCardLayoutC, opts: DrawOptions = {}): void {
  const width = opts.width ?? SHARE_CARD_WIDTH
  const height = opts.height ?? SHARE_CARD_HEIGHT
  const padding = opts.padding ?? PADDING
  const maxWidth = width - padding * 2
  const emit = (t: string, x: number, yPos: number) => {
    ctx.fillText(t, x, yPos)
    opts.onText?.(t)
  }

  ctx.fillStyle = '#0e0d12'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#17151d'
  ctx.fillRect(padding / 2, padding / 2, width - padding, height - padding)

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  let y = padding + 40
  ctx.fillStyle = '#9a93a6'
  ctx.font = `${SHARE_FONT.brand}px sans-serif`
  emit(layout.brand, padding, y)
  y += 28

  ctx.fillStyle = '#ece8f1'
  ctx.font = `${SHARE_FONT.title}px sans-serif`
  for (const line of wrap(ctx, layout.title, maxWidth)) {
    emit(line, padding, y)
    y += SHARE_FONT.title + 12
  }
  y += 24

  // 九宫：3×3，每格 宫名 / 星 / 门 / 神 / 天盘干·地盘干，标记合并一行靠格底
  const gridW = Math.min(maxWidth, 560)
  const cell = gridW / 3
  const gx = padding + (maxWidth - gridW) / 2
  const gy = y
  const rowH = 30
  for (let i = 0; i < layout.palaces.length; i++) {
    const c = layout.palaces[i]
    const col = i % 3
    const row = Math.floor(i / 3)
    const x = gx + col * cell
    const cy = gy + row * cell
    // 边框（Ctx2D 最小接口只有 fillRect，用双层块模拟描边）
    ctx.fillStyle = '#2a2733'
    ctx.fillRect(x, cy, cell - 6, cell - 6)
    ctx.fillStyle = '#141219'
    ctx.fillRect(x + 2, cy + 2, cell - 10, cell - 10)

    ctx.fillStyle = '#ece8f1'
    ctx.font = `${SHARE_FONT.meta}px sans-serif`
    let ry = cy + 32
    const put = (t: string) => {
      emit(t, x + 12, ry)
      ry += rowH
    }
    put(`${c.name}${c.palace}`)
    if (c.star) put(c.star)
    if (c.door) put(`${c.door}门`)
    if (c.god) put(c.god)
    put(`${c.heavenlyGan}·${c.earthlyGan}`)
    const marks = [c.isZhiFu && '值符', c.isZhiShi && '值使', c.isKong && '空亡', c.isMa && '驿马']
      .filter(Boolean)
      .join('·')
    if (marks) emit(marks, x + 12, cy + cell - 16)
  }
  y = gy + gridW + 24

  if (layout.source || layout.school) {
    ctx.fillStyle = '#9a93a6'
    ctx.font = `${SHARE_FONT.meta}px sans-serif`
    const meta = [layout.source, layout.school].filter(Boolean).join(' · ')
    for (const line of wrap(ctx, meta, maxWidth)) {
      emit(line, padding, y)
      y += SHARE_FONT.meta + 10
    }
  }

  // 免责常驻底部（首行基线即 footTop）
  ctx.fillStyle = '#9a93a6'
  ctx.font = `${SHARE_FONT.meta}px sans-serif`
  const footLines = wrap(ctx, layout.disclaimer, maxWidth)
  const footLineH = SHARE_FONT.meta + 10
  let fy = height - padding - (footLines.length - 1) * footLineH
  for (const line of footLines) {
    emit(line, padding, fy)
    fy += footLineH
  }
}

/** 生成盘版分享图 dataURL；环境无 canvas 时返回 null */
export function buildShareCardC(interp: Interpretation, opts: DrawOptions = {}): string | null {
  const layout = qimenShareFromInterpretation(interp)
  if (!layout) return null
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = opts.width ?? SHARE_CARD_WIDTH
  canvas.height = opts.height ?? SHARE_CARD_HEIGHT
  const ctx = canvas.getContext('2d') as unknown as Ctx2D | null
  if (!ctx || typeof ctx.fillText !== 'function') return null
  drawShareCardC(ctx, layout, opts)
  return canvas.toDataURL('image/png')
}

/**
 * 自动选版式：奇门九宫结构齐备走版式 C，卦象齐备走版式 B，否则走版式 A。
 * 三者共同硬约束不变：**只接受 Interpretation，绝不接触用户输入**（YR19）。
 */
export function buildShareCardAuto(interp: Interpretation): string | null {
  if (qimenShareFromInterpretation(interp)) return buildShareCardC(interp)
  if (hexagramShareFromInterpretation(interp)) return buildShareCardB(interp)
  return buildShareCard(interp)
}

/** 触发下载（分享图文件名不含任何 PII：只有时间戳） */
export function downloadDataUrl(dataUrl: string, filename?: string): void {
  if (typeof document === 'undefined') return
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename ?? `jiyi-share-${Date.now()}.png`
  a.click()
}
