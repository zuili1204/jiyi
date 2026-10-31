<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Interpretation, InterpretationBlock } from '@/engine/types'
import { buildShareCardAuto, downloadDataUrl } from '@/platform/shareCard'
import HexagramFigure from './HexagramFigure.vue'
import QimenPanGrid from './QimenPanGrid.vue'
import BaziChart from './BaziChart.vue'
import ZiweiChart from './ZiweiChart.vue'
import LiuyaoTable from './LiuyaoTable.vue'
import MeihuaPanel from './MeihuaPanel.vue'

/**
 * 结果卡片（Y2-05）：三段式 —— 结论 / 依据 / 免责（JY-04 §4）
 *
 * 纪律：
 * - 免责**常驻**，不折叠、不需要用户点开才看到；
 * - 出处与流派必须可见（无源内容不可上线）；
 * - 分享图只由 `buildShareCard` 生成，绝不传入用户原始输入（YR19）。
 */
const props = withDefaults(
  defineProps<{
    interpretation: Interpretation
    /** 是否显示分享图按钮（签占等不涉及 PII 的品类） */
    shareable?: boolean
  }>(),
  { shareable: true }
)

const showBasis = ref(false)
const shareMsg = ref('')

/**
 * 排盘依据的取值格式化
 *
 * `basis` 里既有标量（method / 动爻），也有**结构**（卦象 lines / benGua / bianGua，
 * 分享图版式 B 与卦象图都靠它）。直接 `String(v)` 会把对象渲染成 `[object Object]`，
 * 所以按类型分别格式化 —— 依据区是给人看的，不是给机器看的。
 */
/**
 * 起卦法（basis.method）的值是引擎 CastMethod 键（coin/time/number/text），
 * 与记录的子玩法键（record.method：sign/liujiao/…）是两套语义 ——
 * 不能复用 methodLabel（那里 coin 指内部掷硬币玩法），这里按起卦方式直译。
 */
const CAST_METHOD_LABEL: Record<string, string> = {
  coin: '铜钱摇卦',
  time: '时间起卦',
  number: '数字起卦',
  text: '字数起卦'
}

/** 奇门枚举值（dun / yuan / dingJuMethod）的落库键 → 中文 */
const QIMEN_ENUM: Record<string, string> = {
  yang: '阳遁',
  yin: '阴遁',
  shang: '上元',
  zhong: '中元',
  xia: '下元',
  chaibu: '拆补法',
  zhirun: '置闰法'
}

/** 依据区的键名中文化（引擎侧用英文字段名，展示不该露出） */
const BASIS_LABEL: Record<string, string> = {
  method: '起卦法',
  dongYao: '动爻',
  lines: '六爻（自下而上）',
  benGua: '本卦',
  bianGua: '变卦',
  usedAt: '排盘时刻',
  pillars: '四柱',
  trueSolar: '真太阳时',
  placeUnresolved: '出生地未收录',
  policies: '口径',
  shiShen: '十神',
  geJu: '格局',
  daYun: '大运',
  qimenPan: '九宫',
  siHua: '四化',
  siHuaByPalace: '四化落宫',
  fuXing: '辅煞 / 杂曜',
  zhuXing: '主星',
  daXian: '大限',
  twelveGong: '十二宫',
  // 奇门（Y6-03）
  term: '节气',
  dun: '阴阳遁',
  yuan: '三元',
  ju: '局数',
  dayGanZhi: '日柱',
  dingJuMethod: '定局法',
  plateOrder: '地盘布法',
  xunShou: '旬首',
  zhiFu: '值符',
  zhiShi: '值使',
  kongWang: '时旬空亡',
  kongWangPalaces: '空亡落宫',
  maXing: '驿马',
  maXingPalace: '驿马落宫',
  panNotes: '取法说明'
}

function formatBasisValue(v: unknown, key = ''): string {
  if (key === 'lines' && Array.isArray(v)) {
    return v.map((b) => (b ? '阳' : '阴')).join(' ')
  }
  // 起卦法值是引擎 CastMethod 键（coin / time / number / text）：走起卦法映射，不露英文键
  if (key === 'method') return CAST_METHOD_LABEL[String(v)] ?? String(v)
  // 奇门枚举值（dun / yuan / dingJuMethod）落库是内部键，展示翻成中文
  if (key === 'dun' || key === 'yuan' || key === 'dingJuMethod') {
    return QIMEN_ENUM[String(v)] ?? String(v)
  }
  // 四柱：只取干支文本，别在依据区糊一坨 JSON
  if (key === 'pillars' && v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return (['year', 'month', 'day', 'time'] as const)
      .map((k) => {
        const g = o[k]
        if (!g || typeof g !== 'object') return '—'
        const t = (g as Record<string, unknown>)['text']
        return typeof t === 'string' ? t : '—'
      })
      .join(' ')
  }
  // 排盘时刻 / 口径：同样是给人看的，不是给机器看的
  if (key === 'usedAt' && v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    const p = (n: unknown) => String(typeof n === 'number' ? n : 0).padStart(2, '0')
    return `${o['year']}-${p(o['month'])}-${p(o['day'])} ${p(o['hour'])}:${p(o['minute'])}`
  }
  if (key === 'policies' && v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    const parts: string[] = []
    if (typeof o['newYear'] === 'string') parts.push(`换年：${o['newYear']}`)
    if (typeof o['midnight'] === 'string') parts.push(`子时：${o['midnight']}`)
    if (typeof o['leapMonth'] === 'string') parts.push(`闰月：${o['leapMonth']}`)
    parts.push(o['reviewed'] ? '已核验' : '待核验')
    return parts.join('｜')
  }
  // 奇门：值符 / 值使是「星门 + 落宫」的组合，拆开写比一坨 JSON 好读
  if ((key === 'zhiFu' || key === 'zhiShi') && v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    const what = o['star'] ?? o['door']
    return typeof what === 'string' ? `${what}（${o['palace']} 宫）` : '—'
  }
  if (key === 'xunShou' && v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return `${o['ganZhi']}旬 · 遁${o['yi']}（${o['palace']} 宫）`
  }
  // 落宫一律补"宫"字，别让人猜 4 是什么
  if (key === 'kongWangPalaces' || key === 'maXingPalace') {
    if (Array.isArray(v)) return v.length ? v.map((p) => `${p} 宫`).join('、') : '—'
    if (typeof v === 'number') return `${v} 宫`
  }
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return v.length ? v.map((x) => formatBasisValue(x)).join('、') : '—'
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    // 卦象结构：第 N 卦 名（上X下Y）
    if (typeof o['name'] === 'string') {
      const idx = typeof o['index'] === 'number' ? `第 ${o['index']} 卦 ` : ''
      const tri =
        typeof o['upper'] === 'string' && typeof o['lower'] === 'string'
          ? `（上${o['upper']}下${o['lower']}）`
          : ''
      return `${idx}${o['name']}${tri}`
    }
    // 纯标量映射（如取法说明）：按 `键:值` 平铺，比 JSON 好读
    const flat = Object.entries(o)
    if (
      flat.length &&
      flat.every(([, x]) => x === null || ['string', 'number', 'boolean'].includes(typeof x))
    ) {
      return flat.map(([k, x]) => `${k}:${String(x)}`).join('｜')
    }
    try {
      return JSON.stringify(v)
    } catch {
      return '—'
    }
  }
  return String(v)
}

/**
 * 已由盘面组件画成图的 `basis` 键：依据区不再把它们序列化成 JSON 再糊一遍
 * （内容就在上方盘面里，且盘面自身带「待核校」标注）。其余键一律照旧平铺，
 * 保持"依据可查"这条底线不破。
 */
const VISUAL_KEYS = new Set([
  'pillars',
  'shiShen',
  'geJu',
  'daYun', // 八字盘
  'mingGong',
  'siHua',
  'zhuXing',
  'daXian',
  'siHuaByPalace',
  'fuXing', // 紫微盘
  'najia',
  'wangShuai', // 六爻纳甲表
  'meihua', // 梅花体用盘
  'qimenPan',
  'plate',
  'stars',
  'heavenlyGan',
  'doors' // 奇门九宫
])

const basisEntries = computed(() => {
  const b = props.interpretation.basis ?? {}
  return Object.entries(b)
    .filter(([k]) => !VISUAL_KEYS.has(k))
    .map(([k, v]) => ({
      key: BASIS_LABEL[k] ?? k,
      text: formatBasisValue(v, k)
    }))
})

/** 有结构被画成图时说明去处，免得读者以为被藏起来了 */
const visualCount = computed(() =>
  Object.keys(props.interpretation.basis ?? {}).filter((k) => VISUAL_KEYS.has(k)).length
)

const school = computed(() => {
  const s = props.interpretation.school
  return !s || s === 'none' ? undefined : s
})

/**
 * 卦象可视化：数据来自 `basis`（引擎随记录落库的排盘依据），
 * 仍然不碰任何用户输入。签占等无卦象结构的结果返回 null，不画图。
 */
const figure = computed(() => {
  const b = (props.interpretation.basis ?? {}) as Record<string, unknown>
  const lines = b['lines'] as boolean[] | undefined
  const ben = b['benGua'] as
    | { index: number; name: string; upper: string; lower: string }
    | undefined
  if (!lines || lines.length !== 6 || !ben) return null
  const dong = Array.isArray(b['dongYao']) ? (b['dongYao'] as number[]) : []
  const bian = b['bianGua'] as
    | { index: number; name: string; upper?: string; lower?: string }
    | undefined
  // 变卦爻象：动爻阴阳互变
  const bianLines = dong.length ? lines.map((l, i) => (dong.includes(i + 1) ? !l : l)) : undefined
  return { lines, dong, ben, bian, bianLines }
})

/** 奇门九宫结构（Y6-05）：从 basis 中取，不依赖引擎内部类型 */
const qimenPan = computed(() => {
  const b = (props.interpretation.basis ?? {}) as Record<string, unknown>
  const pan = b['qimenPan'] as
    | {
        palace: number
        name: string
        earthlyGan: string
        heavenlyGan: string
        star: string
        door: string | null
        god: string | null
        /** 值符星落宫 */
        isZhiFu?: boolean
        /** 值使门落宫 */
        isZhiShi?: boolean
        /** 时旬空亡落宫 */
        isKong?: boolean
        /** 驿马落宫 */
        isMa?: boolean
      }[]
    | undefined
  return pan && pan.length === 9 ? pan : undefined
})

/**
 * 盘面数据源：一律从 `basis` 取（引擎随记录落库的排盘依据）。
 * 组件不接触用户原始输入（YR19）；取不到结构就返回 undefined，绝不画空盘。
 */
const basisOf = computed(() => (props.interpretation.basis ?? {}) as Record<string, unknown>)

/** 八字四柱盘 */
const baziBasis = computed(() => (basisOf.value['pillars'] ? basisOf.value : undefined))
/** 紫微十二宫盘 */
const ziweiBasis = computed(() => (basisOf.value['mingGong'] ? basisOf.value : undefined))
/** 六爻纳甲表 */
const liuyaoBasis = computed(() => (basisOf.value['najia'] ? basisOf.value : undefined))
/** 梅花体用互变盘 */
const meihuaBasis = computed(() => (basisOf.value['meihua'] ? basisOf.value : undefined))

/** 签诗分行：签诗是竖排语义的短句，按行切开才排得好看。
 * 只做排版，不动一个字。
 */
function lines(t: string): string[] {
  return t
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/**
 * 分区卡片：主块 + 紧随其后的「说明」核校脚注并成一张卡。
 *
 * 引擎把核校提示作为独立块（label「说明」）追加在旺衰 / 纳甲 / 判读等主块之后，
 * 平铺渲染会造成「说明」标题反复出现、小节连续堆叠没层级。这里只做展示层分组：
 * 说明文字原样保留（核校提示必须可见，不折叠、不删字），只是不再单独占一个标题位。
 * 开头就出现「说明」（无主块可挂）时仍自成一组，绝不丢内容。
 */
interface BlockGroup {
  key: string
  main: InterpretationBlock
  notes: InterpretationBlock[]
}
const blockGroups = computed<BlockGroup[]>(() => {
  const groups: BlockGroup[] = []
  for (const b of props.interpretation.blocks) {
    if (b.label === '说明' && groups.length > 0) {
      groups[groups.length - 1]!.notes.push(b)
    } else {
      groups.push({ key: b.key, main: b, notes: [] })
    }
  }
  return groups
})

function onShare() {
  // canvas 生成 / 触发下载在个别环境会抛（内存不足 / WebView 限制）：不崩溃，给替代路径
  try {
    // 自动选版式：卦象结构齐备 → 版式 B（卦版），否则版式 A（签版）
    const url = buildShareCardAuto(props.interpretation)
    if (!url) {
      shareMsg.value = '当前环境不支持生成图片，请改用截图分享。'
      return
    }
    downloadDataUrl(url)
    shareMsg.value = '分享图已生成（不含任何个人信息）。'
  } catch (e) {
    console.warn('[jiyi] 分享图生成失败：', e)
    shareMsg.value = '生成分享图失败，请改用截图分享。'
  }
}
</script>

<template>
  <section class="result">
    <header class="conclusion">
      <h2>{{ interpretation.title }}</h2>

      <!-- 卦象：本卦 + 之卦（有动爻时才画之卦） -->
      <div v-if="figure" class="figures">
        <HexagramFigure
          :lines="figure.lines"
          :dong-yao="figure.dong"
          :name="`第 ${figure.ben.index} 卦 ${figure.ben.name}`"
          :upper="figure.ben.upper"
          :lower="figure.ben.lower"
          caption="本卦"
        />
        <HexagramFigure
          v-if="figure.bian && figure.bianLines"
          :lines="figure.bianLines"
          :name="`第 ${figure.bian.index} 卦 ${figure.bian.name}`"
          :upper="figure.bian.upper"
          :lower="figure.bian.lower"
          caption="之卦"
        />
      </div>

      <QimenPanGrid v-if="qimenPan" :cells="qimenPan" />
      <BaziChart v-if="baziBasis" :basis="baziBasis" />
      <ZiweiChart v-if="ziweiBasis" :basis="ziweiBasis" />
      <LiuyaoTable v-if="liuyaoBasis" :basis="liuyaoBasis" />
      <MeihuaPanel v-if="meihuaBasis" :basis="meihuaBasis" />

      <!-- 分区卡片：主块一卡一位，「说明」类核校脚注并入所属卡片，不再重复占标题 -->
      <div
        v-for="g in blockGroups"
        :key="g.key"
        class="block"
        :class="{ 'block--poem': g.main.key === 'poem' }"
      >
        <div class="label">{{ g.main.label }}</div>
        <!-- 签诗：按行排版、衬线居中，别糊成一坨散文 -->
        <div v-if="g.main.key === 'poem'" class="poem">
          <p v-for="(ln, i) in lines(g.main.text)" :key="i" class="poem-line">{{ ln }}</p>
        </div>
        <p v-else class="text">{{ g.main.text }}</p>
        <p v-for="n in g.notes" :key="n.key" class="note">{{ n.text }}</p>
      </div>
      <p v-if="school" class="school">采用流派 / 版本：{{ school }}</p>
    </header>

    <section class="basis">
      <button class="basis-toggle" :aria-expanded="showBasis" @click="showBasis = !showBasis">
        {{ showBasis ? '收起' : '展开' }}排盘依据
      </button>
      <dl v-if="showBasis">
        <p v-if="visualCount" class="basis-hint">
          其中 {{ visualCount }} 项排盘结构已在上方以图表呈现，此处不再重复罗列。
        </p>
        <div v-for="e in basisEntries" :key="e.key" class="basis-row">
          <dt>{{ e.key }}</dt>
          <dd>{{ e.text }}</dd>
        </div>
        <div v-if="interpretation.source" class="basis-row">
          <dt>出处</dt>
          <dd>{{ interpretation.source }}</dd>
        </div>
        <div v-if="interpretation.degraded?.length" class="basis-row">
          <dt>口径</dt>
          <dd>部分排盘口径暂按通行版本呈现，界面同时保留核校提示。</dd>
        </div>
      </dl>
    </section>

    <footer class="footer">
      <button v-if="shareable" class="share" @click="onShare">生成分享图</button>
      <p v-if="shareMsg" class="share-msg">{{ shareMsg }}</p>
      <p class="disclaimer">结果仅供参考，不构成任何决策建议；命运在己，慎思笃行。</p>
      <p v-if="interpretation.source" class="source">内容出处：{{ interpretation.source }}</p>
    </footer>
  </section>
</template>

<style scoped>
.figures {
  display: flex;
  gap: 0.12rem;
  justify-content: center;
  padding: 0.08rem 0;
  border-radius: var(--radius-s);
  background: var(--bg-2);
}
.result {
  margin-top: 0.14rem;
  padding: 0.14rem;
  border-radius: var(--radius);
  background: var(--panel);
  border: 1px solid var(--line-soft);
}
h2 {
  margin: 0 0 0.08rem;
  font-size: 0.17rem;
  line-height: 1.4;
}
/* 分区卡片：一节一位，解决小节标题与值文本连续堆叠的弱层级 */
.block {
  margin-bottom: 0.08rem;
  padding: 0.1rem 0.12rem;
  border-radius: var(--radius-s);
  background: var(--panel-2);
  border: 1px solid var(--line-soft);
}
/* 签诗卡：签条自身带底与边，卡片壳退场只留间距 */
.block--poem {
  background: transparent;
  border: none;
  padding: 0;
}
.label {
  display: flex;
  align-items: center;
  gap: 0.05rem;
  font-size: 0.12rem;
  color: var(--text-2);
  letter-spacing: 0.02em;
  margin-bottom: 0.04rem;
}
/* 青铜小竖标：卡片头的「徽记」，呼应辅色语义 */
.label::before {
  content: '';
  width: 0.02rem;
  height: 0.1rem;
  border-radius: var(--radius-pill);
  background: var(--bronze);
}
.text {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.75;
  font-size: 0.14rem;
}
/* 核校说明脚注：并入所属卡片，细分隔线 + 次级文字，可见但不抢层级 */
.note {
  margin: 0.06rem 0 0;
  padding-top: 0.06rem;
  border-top: 1px dashed var(--line-soft);
  font-size: 0.11rem;
  color: var(--text-3);
  line-height: 1.7;
}
.note + .note {
  border-top: none;
  padding-top: 0;
  margin-top: 0.02rem;
}
.school {
  font-size: 0.11rem;
  color: var(--text-3);
  margin: 0.05rem 0 0;
}
.basis {
  margin-top: 0.1rem;
  border-top: 1px dashed var(--line-soft);
  padding-top: 0.08rem;
}
.basis-toggle {
  min-height: 0.44rem;
  border: none;
  background: transparent;
  color: var(--cinnabar-bright);
  font-size: 0.12rem;
  padding: 0;
}
dl {
  margin: 0.06rem 0 0;
  font-size: 0.12rem;
}
.basis-row {
  display: flex;
  gap: 0.08rem;
  padding: 0.02rem 0;
}
dt {
  color: var(--text-3);
  min-width: 0.56rem;
}
dd {
  margin: 0;
  word-break: break-all;
}
.footer {
  margin-top: 0.12rem;
  border-top: 1px dashed var(--line-soft);
  padding-top: 0.08rem;
}
.share {
  min-height: 0.44rem;
  width: 100%;
  border: none;
  border-radius: var(--radius-pill);
  background: var(--cinnabar);
  color: #fff;
  font-size: 0.14rem;
}
.share-msg {
  font-size: 0.11rem;
  color: var(--text-2);
  margin: 0.06rem 0 0;
}
.disclaimer {
  font-size: 0.11rem;
  color: var(--text-3);
  margin: 0.08rem 0 0;
  line-height: 1.7;
}
.source {
  font-size: 0.11rem;
  color: var(--text-3);
  margin: 0.05rem 0 0;
}
/* 签诗：上下双细线 + 衬线居中，做出"签条"的样子（色值全走 token） */
.poem {
  margin: 0.04rem 0 0;
  padding: 0.12rem 0.1rem;
  border-radius: var(--radius-s);
  border: 1px solid var(--line);
  background: linear-gradient(180deg, rgba(192, 72, 60, 0.08), var(--bg-2));
  text-align: center;
}
.poem-line {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 0.15rem;
  line-height: 2;
  letter-spacing: 0.04em;
  color: var(--text);
}
.poem-line + .poem-line {
  margin-top: 0.02rem;
}
.basis-hint {
  margin: 0.06rem 0 0;
  font-size: 0.1rem;
  color: var(--text-3);
  line-height: 1.7;
}
</style>
