<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import SchemaForm from '@/components/SchemaForm.vue'
import CategoryIcon from '@/components/CategoryIcon.vue'
import BirthDataConsent from '@/components/BirthDataConsent.vue'
import ReadingResult from '@/components/ReadingResult.vue'
import DivinationStage from '@/components/divination/DivinationStage.vue'
import { buildLotsRecord } from '@/engine/lots'
import type { LotKind } from '@/engine/lots'
import { buildIchingRecord } from '@/engine/iching'
import { baziEngine, buildBaziRecord, BAZI_SCHEMA } from '@/engine/bazi'
import type { BaziInput } from '@/engine/bazi'
import { buildQimenRecord, QIMEN_SCHEMA } from '@/engine/qimen'
import { buildZiweiRecord, ziweiEngine, ZIWEI_SCHEMA } from '@/engine/ziwei'
import { createRandomSource } from '@/engine/random'
import { CATEGORIES } from '@/data/categories'
import type { CategoryKey } from '@/data/categories'
import { useRecordsStore } from '@/stores/records'
import { useSettingsStore } from '@/stores/settings'
import { useToastStore } from '@/stores/toast'
import { friendlyMessage } from '@/platform/errors'
import { LOT_KINDS } from '@/data/content/lots'
import { methodLabel, methodAccent } from '@/types/reading'
import type { InputSchema } from '@/types/input'
import type { ReadingRecord } from '@/types/reading'
import type { DivinationEngine, Interpretation } from '@/engine/types'

/**
 * 首页（Y2-04 / Y2-05 / Y3-10）
 *
 * 结构：品牌头 → 品类入口（六格，未上线品类占位并提示）→ 起卦区 → 最近记录。
 *
 * 纪律：
 * - **未上线的品类给入口、不给假功能**：点下去只提示「正在开发中」，不跳转、不半做。
 * - 动效降级（reduce-motion / low-end）时摇卦等待为 0ms，结果完全一致。
 * - 结果**不堆在首页**：出签 / 成卦后跳转 `/record/:id` 详情页（结果很长，
 *   内联会把品类入口与表单顶出屏幕）。首页只保留起卦与最近记录。
 */
const store = useRecordsStore()
const settings = useSettingsStore()
const toast = useToastStore()
const router = useRouter()

/** 可实际起卦的玩法（品类来源于共享 categories.ts，JY-14 T3-1） */
type Mode = CategoryKey
type MeihuaType = 'time' | 'number' | 'text'

const active = ref<Mode>('lots')
const kind = ref<LotKind>('guanyin')
const meihuaType = ref<MeihuaType>('time')

function pickCategory(key: CategoryKey) {
  const cat = CATEGORIES.find((c) => c.key === key)!
  if (!cat.ready) {
    // 预留位置、不给假功能：明确告知，而不是跳一个空壳页
    toast.show(`「${cat.name}」正在开发中`)
    return
  }
  cancelPending() // 摇卦等待中切品类：先撤掉挂起的那一卦，别让它落到新品类头上
  active.value = key as Mode
  model.value = {}
  showConsent.value = false
  unsaved.value = null
}

const SCHEMAS: Record<Mode, InputSchema> = {
  lots: {
    fields: [
      { key: 'note', label: '心中所问（可选，仅保存在本机）', type: 'text', required: false }
    ]
  },
  liujiao: {
    fields: [
      { key: 'question', label: '心中所问（可选，仅保存在本机）', type: 'text', required: false },
      {
        key: 'at',
        label: '问占时刻',
        type: 'datetime',
        required: false,
        help: '留空则按当前时刻；月建 / 日辰 / 旬空由此推出'
      }
    ]
  },
  meihua: { fields: [] },
  bazi: BAZI_SCHEMA,
  qimen: QIMEN_SCHEMA,
  ziwei: ZIWEI_SCHEMA
}

const MEIHUA_SCHEMAS: Record<MeihuaType, InputSchema> = {
  time: {
    fields: [
      {
        key: 'at',
        label: '问占时刻',
        type: 'datetime',
        required: false,
        help: '留空则按当前时刻（农历年月日 + 时辰起卦）'
      },
      { key: 'question', label: '心中所问（可选）', type: 'text', required: false }
    ]
  },
  number: {
    fields: [
      { key: 'a', label: '第一数', type: 'number', required: true, min: 1 },
      { key: 'b', label: '第二数', type: 'number', required: true, min: 1 }
    ]
  },
  text: {
    fields: [
      {
        key: 'text',
        label: '所书文字',
        type: 'text',
        required: true,
        help: '按字数起卦：前段为上卦、后段为下卦、总字数为动爻'
      }
    ]
  }
}

const schema = computed(() =>
  active.value === 'meihua' ? MEIHUA_SCHEMAS[meihuaType.value] : SCHEMAS[active.value]
)

const model = ref<Record<string, unknown>>({})

/**
 * 摇卦是否需要等待用户「停」：
 * 动效降级（reduce-motion / low-end）时 0 等待——起卦立即完成，不弹「停」，
 * 结果一致，只是少了仪式动画（纪律：不是把动画藏起来，而是根本不等待）。
 */
const noWait = computed(() => settings.reduceMotion || settings.lowEnd)
const shaking = ref(false)

/**
 * 落定段：问卦人按下「停」、卦已定的那一瞬，用真实结果把盘面「落」一遍
 * （约 0.9s：签升起 / 六爻堆叠 / 四柱立起 / 星宫点亮 / 天盘盖下），演完再进详情页。
 * 降级（reduce-motion / low-end）时不演，0 等待直接进（纪律：不是藏动画，是不等待）。
 */
interface SettleView {
  mode: Mode
  data: Record<string, unknown>
}
const settle = ref<SettleView | null>(null)
let settleTimer: number | undefined
const SETTLE_MS = 900

/** 等待段与落定段的用户可见文案（不含开发术语） */
const LOOP_LABEL: Record<Mode, string> = {
  lots: '摇签中…',
  liujiao: '摇卦中…',
  meihua: '观机中…',
  bazi: '',
  ziwei: '',
  qimen: '转盘中…'
}
const SETTLE_LABEL: Record<Mode, string> = {
  lots: '签已出',
  liujiao: '卦已成',
  meihua: '象已现',
  bazi: '四柱已立',
  ziwei: '星已安',
  qimen: '局已定'
}

/**
 * 待执行的取卦任务（挂起的摇卦）。
 * 「停」的落点：用户按下抉择的那一个瞬间才用当下的随机源定卦/取签。
 * 真到那一步才冲 draw()；等待期内切品类 / 离开首页时撤销它，不让旧表单账到新品类头上。
 */
let pendingDraw: (() => void) | undefined

function cancelPending() {
  pendingDraw = undefined
  shaking.value = false
  // 落定段若被切换品类 / 离开首页打断：记录已在「停」时落库，只撤掉演出与跳转
  if (settleTimer !== undefined) {
    clearTimeout(settleTimer)
    settleTimer = undefined
  }
  settle.value = null
}

onBeforeUnmount(cancelPending)

/** datetime-local（YYYY-MM-DDTHH:mm）→ 起卦所需字段；留空取当前时刻 */
function parseAt(value: unknown) {
  const s = typeof value === 'string' ? value.trim() : ''
  if (s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(s)
    if (m) {
      return {
        year: Number(m[1]),
        month: Number(m[2]),
        day: Number(m[3]),
        hour: Number(m[4]),
        minute: Number(m[5])
      }
    }
  }
  const d = new Date()
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes()
  }
}

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `r-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

/** 出生数据授权（J4 / Y4-04）：八字与紫微共用同一条流程，未同意不落盘（Y5-08 零重复） */
const showConsent = ref(false)
const birthDraft = ref<BaziInput | null>(null)
/** 用户拒绝授权时的排盘结果：只显示，不落库 */
const unsaved = ref<Interpretation | null>(null)

function commitBirth(input: BaziInput) {
  const mode = active.value
  try {
    const rec =
      mode === 'ziwei'
        ? buildZiweiRecord(input, genId())
        : buildBaziRecord(input, genId())
    if (!store.add(rec)) {
      toast.show(store.lastError ?? '记录写入失败')
      return
    }
    finishDraw(mode, rec)
  } catch (e) {
    // 排盘引擎对越界日期等会抛错：兜底转成可理解的提示，不让页面悬死
    console.warn('[jiyi] 排盘失败：', e)
    toast.show(friendlyMessage(e, '排盘未完成，请检查所填信息后重试'))
  }
}

function onConsent(agreed: boolean) {
  showConsent.value = false
  const input = birthDraft.value
  if (!input) return
  if (!agreed) {
    // 拒绝授权：结果照算给人看，但**不落库**
    const eng: DivinationEngine<any, any> = active.value === 'ziwei' ? ziweiEngine : baziEngine
    try {
      unsaved.value = eng.interpret(eng.compute(input, { next: () => 0, int: () => 0 }))
    } catch (e) {
      console.warn('[jiyi] 排盘失败：', e)
      toast.show(friendlyMessage(e, '排盘未完成，请检查所填信息后重试'))
      return
    }
    toast.show('未授权保存出生数据，本次结果不会存入记录')
    return
  }
  settings.grantBirthDataConsent()
  commitBirth(input)
}

function onSubmitBirth(v: Record<string, unknown>) {
  birthDraft.value = {
    ...parseAt(v.at),
    place: (v.place as string) ?? '',
    gender: (v.gender as BaziInput['gender']) ?? undefined
  }
  unsaved.value = null
  if (!settings.birthDataConsent) {
    showConsent.value = true // 先问，不落盘
    return
  }
  commitBirth(birthDraft.value)
}

function onSubmit(v: Record<string, unknown>) {
  if (shaking.value || settle.value) return
  // 冻结提交瞬间的品类与玩法：摇卦有等待期，期间用户可能切走，
  // 若在 draw 里读 active.value，就会按新品类去起旧表单的卦
  const mode = active.value
  const meihuaT = meihuaType.value
  if (mode === 'bazi' || mode === 'ziwei') {
    // 出生数据类：共用同意流程（Y4-04 / Y5-08 零重复），未授权不落盘
    onSubmitBirth(v)
    return
  }
  const draw = () => {
    // 引擎对非法输入（如越界时刻）会抛错：兜底转提示，绝不让「停」把页面卡死
    try {
      // 真到「停」这一瞬才取随机源：随机种子以当下的时刻为依，即"心念所停处即卦"
      const rng = createRandomSource()
      const id = genId()
      const question = (v.question as string) ?? ''

      let rec
      if (mode === 'lots') {
        rec = buildLotsRecord({ note: (v.note as string) ?? '', kind: kind.value }, rng, id)
      } else if (mode === 'liujiao') {
        rec = buildIchingRecord({ question, at: parseAt(v.at) }, rng, id, 'liujiao')
      } else if (mode === 'qimen') {
        const at = v.at ? parseAt(v.at) : undefined
        rec = buildQimenRecord({ at, question: (v.question as string) ?? '' }, id)
      } else {
        const input =
          meihuaT === 'time'
            ? { type: 'time' as const, question, ...parseAt(v.at) }
            : meihuaT === 'number'
              ? { type: 'number' as const, question, a: Number(v.a), b: Number(v.b) }
            : {
                type: 'text' as const,
                question,
                text: String(v.text ?? ''),
                // JY-08 拍板「字占加时辰」：动爻 = (字数 + 时辰支)%6，故必须给时刻；
                // 表单未提供时与「时间起卦」同口径 —— 取起卦瞬间（parseAt 的兜底）。
                hour: parseAt(v.at).hour
              }
        rec = buildIchingRecord(input, rng, id, 'meihua')
      }

      // 落库失败（已达 200 条上限）→ 明确告知并留在首页，**不跳转**（跳过去也是空壳详情）
      if (!store.add(rec)) {
        toast.show(store.lastError ?? '记录写入失败')
        shaking.value = false
        return
      }
      shaking.value = false
      // 落定段演完进详情页，首页不再内联长文本
      finishDraw(mode, rec)
    } catch (e) {
      console.warn('[jiyi] 起卦失败：', e)
      shaking.value = false
      toast.show(friendlyMessage(e, '起卦未完成，请稍后再试'))
    }
  }

  if (noWait.value) {
    // 降级：立即完工，不进等待、不给「停」
    draw()
    return
  }
  // 正常路径：不预设时长，挂起取卦任务，等待问卦人主动按下「停」——
  // 交回「何时定卦」的控制权，正是这段互动的意义（Y2-06 仪式感）。
  pendingDraw = draw
  shaking.value = true
}

/** 落定段演完进详情页；降级时不演落定段，直接进（0 等待） */
function finishDraw(mode: Mode, rec: ReadingRecord) {
  if (noWait.value) {
    router.push({ name: 'record', params: { id: rec.id } })
    return
  }
  settle.value = { mode, data: rec.result }
  settleTimer = window.setTimeout(() => {
    settleTimer = undefined
    settle.value = null
    router.push({ name: 'record', params: { id: rec.id } })
  }, SETTLE_MS)
}

/**
 * 用户主动「停」：用当下的随机时刻定卦/取签。
 * 只响应一次——触发后清空 pendingDraw，再次连点不再生效。
 */
function stopDivination() {
  if (!pendingDraw) return
  const d = pendingDraw
  pendingDraw = undefined
  shaking.value = false
  d()
}

function pickMeihuaType(t: MeihuaType) {
  cancelPending() // 换玩法同理：时间 / 数字 / 字数的表单结构不同，旧提交不能顺延
  meihuaType.value = t
  model.value = {}
}

function fmtTime(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const recent = computed(() => store.records.slice(-3).reverse())

/** 打开记录详情（与历史页共用同一条入口） */
function open(id: string) {
  router.push({ name: 'record', params: { id } })
}
</script>

<template>
  <div class="page home">
    <!-- 品牌头 -->
    <header class="brand a-fade-up">
      <h1 class="brand-name">稽疑</h1>
      <p class="brand-sub">JiYi · 以占决疑，以卦观变</p>
    </header>

    <!-- 品类入口 -->
    <h2 class="section-title">起占</h2>
    <div class="grid">
      <button
        v-for="(c, i) in CATEGORIES"
        :key="c.key"
        class="cat a-fade-up"
        :class="{ active: active === c.key, soon: !c.ready }"
        :style="{ '--d': `${0.03 * i}s` }"
        :aria-disabled="!c.ready"
        @click="pickCategory(c.key)"
      >
        <span class="cat-icon"><CategoryIcon :kind="c.key" /></span>
        <span class="cat-name">{{ c.name }}</span>
        <span class="cat-desc">{{ c.desc }}</span>
        <span v-if="!c.ready" class="cat-tag">开发中</span>
      </button>
    </div>

    <!-- 起卦区 -->
    <section class="panel a-fade-up" style="--d: 0.2s">
      <div class="panel-head">
        <h3 class="panel-title">{{ CATEGORIES.find((c) => c.key === active)!.name }}</h3>
        <p class="muted">
          {{
            active === 'lots'
              ? '三套签诗，各一百签'
              : active === 'liujiao'
                ? '三枚铜钱，六爻成卦'
                : active === 'meihua'
                  ? '不动不占，因事而感'
                  : active === 'bazi'
                    ? '四柱排盘，先看结构'
                    : active === 'ziwei'
                      ? '定命宫 · 五行局 · 年干四化'
                      : '定局 · 九宫 · 天盘八门'
          }}
        </p>
      </div>

      <div v-if="active === 'lots'" class="sets">
        <button
          v-for="s in LOT_KINDS"
          :key="s.kind"
          class="chip"
          :class="{ on: kind === s.kind }"
          @click="kind = s.kind"
        >
          {{ s.label }}
        </button>
      </div>

      <div v-if="active === 'meihua'" class="sets">
        <button class="chip" :class="{ on: meihuaType === 'time' }" @click="pickMeihuaType('time')">
          时间
        </button>
        <button
          class="chip"
          :class="{ on: meihuaType === 'number' }"
          @click="pickMeihuaType('number')"
        >
          数字
        </button>
        <button class="chip" :class="{ on: meihuaType === 'text' }" @click="pickMeihuaType('text')">
          字数
        </button>
      </div>

      <p v-if="active === 'liujiao' || active === 'meihua'" class="muted note">
        卦爻辞按通行版本呈现，结果页展示卦象结构与旺衰信息。
      </p>
      <p v-else-if="active === 'qimen'" class="muted note">
        奇门盘按拆补法·日支定局，呈现九星 / 八门 / 八神 / 空亡 / 马星结构。
      </p>
      <p v-else-if="active === 'ziwei'" class="muted note">
        出生数据属敏感信息：默认不保存，需你授权后才会写入本机。呈现命宫 / 五行局 / 四化等排盘信息。
      </p>
      <p v-if="active === 'bazi'" class="muted note">
        出生数据属敏感信息：默认不保存，需你授权后才会写入本机。呈现四柱 / 十神 / 格局 / 大运等排盘信息。
      </p>

      <SchemaForm
        :schema="schema"
        :model-value="model"
        @update:model-value="model = $event"
        @submit="onSubmit"
      />

      <div v-if="shaking" class="shaker" aria-live="polite">
        <DivinationStage :mode="active" phase="loop" :label="LOOP_LABEL[active]" />
        <div class="stop-wrap">
          <button type="button" class="stop" @click="stopDivination">
            <span class="stop-word">停</span>
            <span class="stop-hint">心有所感，此时定卦</span>
          </button>
        </div>
      </div>

      <!-- 落定段：卦已定，用真实结果演盘面落定，再进详情页 -->
      <div v-else-if="settle" class="shaker" aria-live="polite">
        <DivinationStage
          :mode="settle.mode"
          phase="settle"
          :data="settle.data"
          :label="SETTLE_LABEL[settle.mode]"
        />
      </div>

      <!-- 出生数据授权：未同意不落盘（J4 / Y4-04） -->
      <BirthDataConsent v-if="showConsent" @resolve="onConsent" />

      <div v-if="unsaved" class="unsaved">
        <p class="muted">本次结果<strong>未保存</strong>（未授权保存出生数据）。</p>
        <ReadingResult :interpretation="unsaved" :shareable="false" />
      </div>
    </section>

    <!-- 最近记录 -->
    <h2 class="section-title">最近</h2>
    <div v-if="recent.length" class="recent">
      <div
        v-for="r in recent"
        :key="r.id"
        class="rec"
        role="button"
        tabindex="0"
        :aria-label="`查看 ${r.interpretation.title}`"
        :style="{ '--accent': methodAccent(r.method) }"
        @click="open(r.id)"
        @keydown.enter.prevent="open(r.id)"
        @keydown.space.prevent="open(r.id)"
      >
        <div class="rec-main">
          <p class="rec-title">
            {{ r.interpretation.title }}
            <span v-if="r.ai" class="ai-badge">AI</span>
          </p>
          <p class="muted rec-meta">
            <span class="dot" aria-hidden="true"></span>
            <span class="method">{{ methodLabel(r.method) }}</span>
            <span> · {{ fmtTime(r.createdAt) }}</span>
          </p>
        </div>
        <span class="rec-go" aria-hidden="true">›</span>
      </div>
    </div>
    <p v-else class="muted">暂无记录，先起一卦吧。</p>
  </div>
</template>

<style scoped>
.home {
  position: relative;
  z-index: 1;
}

.brand {
  text-align: center;
  padding: 0.12rem 0 0.06rem;
}
.brand-name {
  font-size: 0.28rem;
  letter-spacing: 0.06em;
  background: linear-gradient(120deg, var(--text) 20%, var(--cinnabar-bright) 50%, var(--bronze-bright) 78%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.brand-sub {
  font-size: 0.12rem;
  color: var(--text-2);
  letter-spacing: 0.04em;
  margin-top: 0.02rem;
}

/* 品类网格 */
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.08rem;
}
.cat {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.03rem;
  padding: 0.12rem 0.04rem;
  min-height: 0.86rem;
  border-radius: var(--radius);
  border: 1px solid var(--line-soft);
  background: var(--panel);
  color: var(--text);
  transition: transform var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out),
    background var(--dur-fast) var(--ease-out);
}
.cat:not(.soon):hover,
.cat:not(.soon):focus-visible {
  transform: translateY(-0.02rem);
  border-color: var(--bronze-dim);
  outline: none;
}
.cat.active {
  border-color: var(--cinnabar-dim);
  background: linear-gradient(180deg, rgba(192, 72, 60, 0.14), var(--panel));
}
.cat.active .cat-icon {
  color: var(--cinnabar-bright);
}
.cat.soon {
  opacity: 0.66;
}
.cat-icon {
  color: var(--bronze-bright);
}
.cat-name {
  font-family: var(--font-serif);
  font-size: 0.14rem;
}
.cat-desc {
  font-size: 0.1rem;
  color: var(--text-3);
  line-height: 1.3;
  text-align: center;
  /* 词组整体换行：避免「大运」这类词被拆到两行 */
  word-break: keep-all;
}
.cat-tag {
  position: absolute;
  top: 0.05rem;
  right: 0.05rem;
  font-size: 0.09rem;
  padding: 0 0.05rem;
  border-radius: var(--radius-pill);
  color: var(--text-3);
  border: 1px solid var(--line-soft);
}

/* 起卦面板 */
.panel {
  margin-top: 0.14rem;
  padding: 0.14rem;
  border-radius: var(--radius);
  border: 1px solid var(--line-soft);
  background: var(--panel);
}
.panel-head {
  margin-bottom: 0.1rem;
}
.panel-title {
  font-size: 0.16rem;
  color: var(--cinnabar-bright);
}
.note {
  margin: 0.06rem 0;
  line-height: 1.6;
}

.sets {
  display: flex;
  gap: 0.06rem;
  margin-bottom: 0.1rem;
}
.chip {
  flex: 1;
  min-height: 0.36rem;
  padding: 0 0.08rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--line-soft);
  font-size: 0.12rem;
  color: var(--text-2);
}
.chip.on {
  color: #fff;
  background: var(--cinnabar);
  border-color: transparent;
}

.shaker {
  margin-top: 0.14rem;
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
}
.stop-wrap {
  display: flex;
  justify-content: center;
}
.stop {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.03rem;
  width: 0.82rem;
  height: 0.82rem;
  padding: 0;
  border-radius: 50%;
  border: 1px solid var(--cinnabar-bright);
  background: radial-gradient(circle at 50% 32%, rgba(255, 255, 255, 0.1), transparent 60%),
    var(--cinnabar);
  color: #fff;
  cursor: pointer;
  animation: stopBreathe 1.6s ease-in-out infinite;
}
.stop:focus-visible {
  outline: none;
  box-shadow: 0 0 0 0.03rem color-mix(in srgb, var(--cinnabar-bright) 40%, transparent);
}
.stop-word {
  font-family: var(--font-serif);
  font-size: 0.22rem;
  line-height: 1;
  margin-top: 0.18rem;
  text-shadow: 0 0.01rem 0.02rem rgba(0, 0, 0, 0.3);
}
.stop-hint {
  font-size: 0.09rem;
  line-height: 1.2;
  opacity: 0.92;
  letter-spacing: 0.02em;
}
@keyframes stop-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(192, 72, 60, 0.45);
  }
  50% {
    box-shadow: 0 0 0 0.06rem rgba(192, 72, 60, 0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .stop {
    animation: none;
  }
}

/* 最近记录 */
.recent {
  display: flex;
  flex-direction: column;
  gap: 0.06rem;
}
.rec {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.08rem;
  padding: 0.1rem 0.12rem;
  border-radius: var(--radius);
  background: var(--panel);
  border: 1px solid var(--line-soft);
  cursor: pointer;
  transition: transform var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out);
}
.rec:hover,
.rec:focus-visible {
  transform: translateY(-0.02rem);
  border-color: var(--bronze-dim);
  outline: none;
}
.rec-title {
  font-family: var(--font-serif);
  font-size: 0.14rem;
}
.ai-badge {
  display: inline-block;
  vertical-align: 0.02rem;
  margin-left: 0.04rem;
  font-size: 0.09rem;
  line-height: 1;
  padding: 0.02rem 0.06rem;
  border-radius: var(--radius-pill);
  color: var(--bronze-bright);
  border: 1px solid var(--bronze-dim);
  font-family: var(--font-sans);
}
.rec-meta {
  display: flex;
  align-items: center;
  margin-top: 0.02rem;
}
/* 品类色点 + 同色玩法名（METHOD_ACCENT，只引 token） */
.dot {
  flex: none;
  width: 0.07rem;
  height: 0.07rem;
  margin-right: 0.05rem;
  border-radius: 50%;
  background: var(--accent, var(--text-3));
}
.method {
  color: var(--accent, var(--text-2));
}
.rec-go {
  flex: none;
  color: var(--text-3);
  font-size: 0.16rem;
}
</style>
