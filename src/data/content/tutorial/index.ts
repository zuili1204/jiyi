import doc from './tutorial.json'

/**
 * 教程内容包（JY-14）
 *
 * ⚠️ 本目录 `tutorial.json` 是**产物**，由 `npm run content:sync` 从
 * `DOCS/content/tutorial/tutorial.json` 单向生成，**禁止手改**。本 index.ts 为类型化导出层，
 * 与 `qimen/index.ts` 同模式：人工只在母版改文案，`content:sync` 重生成 json。
 *
 * 纪律：
 * - 教程是产品自撰文案，走**全词族严扫**（`familyByKind.tutorial`），不享受原文豁免；
 * - 各玩法 `status` 须与发布规划一致，不把未完成写成已完成（JY-14 §8）。
 */

/** 玩法类型键：与 JY-01 §1 品类 key 对齐 */
export type TutorialMethodKey = 'lots' | 'liujiao' | 'meihua' | 'bazi' | 'ziwei' | 'qimen'

export type MethodStatus = 'ready' | 'partial'

export interface TutorialMethod {
  type: 'method'
  id: string
  key: TutorialMethodKey
  name: string
  clan: string
  input: string
  output: string
  difficulty: string
  school: string
  status: MethodStatus
  suit: string[]
  caution: string
  desc: string
}

export interface IntroItem {
  type: 'intro'
  id: string
  title: string
  paragraphs: string[]
}

export interface GuideItem {
  scenario: string
  /** 场景一句话说明（点选前即可见，帮助对号入座） */
  say?: string
  recommend: TutorialMethodKey[]
  note?: string
}

export interface GuideEntry {
  type: 'guide'
  id: string
  title: string
  intro: string
  items: GuideItem[]
  note?: string
}

/** 易学图示条目：key 对应 TutorialView 中的图示组件映射 */
export interface FigureItem {
  type: 'figure'
  id: string
  key: string
  name: string
  /** 常显的一句话：看什么 */
  brief: string
  /** 展开后的讲解 */
  detail: string
}

export interface OperationStep {
  title: string
  text: string
}

export interface OperationEntry {
  type: 'operation'
  id: string
  title: string
  steps: OperationStep[]
}

export interface ComplianceEntry {
  type: 'compliance'
  id: string
  title: string
  disclaimer: string
  age: string
  dataLocal: string
  school: string
  privacy: string
}

export type TutorialItem =
  | IntroItem
  | TutorialMethod
  | GuideEntry
  | FigureItem
  | OperationEntry
  | ComplianceEntry

interface TutorialDoc {
  version: number
  kind: string
  school: string
  license: string
  source: string
  sourceNote?: string
  reviewed: boolean
  items: TutorialItem[]
}

const tutorial = doc as unknown as TutorialDoc

export const TUTORIAL_META = {
  version: tutorial.version,
  school: tutorial.school,
  license: tutorial.license,
  source: tutorial.source,
  sourceNote: tutorial.sourceNote,
  reviewed: tutorial.reviewed
}

/** 序言/说明类条目 */
export const introItems: IntroItem[] = tutorial.items.filter(
  (it): it is IntroItem => it.type === 'intro'
)

/** 六玩法介绍（按母版原始顺序，key 与 JY-01 品类对齐） */
export const methods: TutorialMethod[] = tutorial.items.filter(
  (it): it is TutorialMethod => it.type === 'method'
)

/** 「怎么选」决策指南 */
export const guideEntries: GuideEntry[] = tutorial.items.filter(
  (it): it is GuideEntry => it.type === 'guide'
)

/** 易学图示（按母版原始顺序） */
export const figureItems: FigureItem[] = tutorial.items.filter(
  (it): it is FigureItem => it.type === 'figure'
)

/** 操作指引 */
export const operationEntries: OperationEntry[] = tutorial.items.filter(
  (it): it is OperationEntry => it.type === 'operation'
)

/** 合规须知 */
export const complianceEntries: ComplianceEntry[] = tutorial.items.filter(
  (it): it is ComplianceEntry => it.type === 'compliance'
)

const methodById = new Map<string, TutorialMethod>(methods.map((m) => [m.key, m]))

export function methodByKey(key: string): TutorialMethod | undefined {
  return methodById.get(key)
}

/** 合规须知入口（默认取第一个） */
export const compliance = complianceEntries[0]

export default tutorial