<script setup lang="ts">
/**
 * 八字结果可视化：四柱干支表 + 五行分布 + 大运序列
 *
 * 数据只从 `interpretation.basis` 取（引擎随记录落库的排盘依据），
 * **不接收、也不渲染任何用户原始输入**（YR19）。
 *
 * 纪律：
 * - 只把结构画出来，不生成任何吉凶评断；
 * - 「待核校」的口径（取格 / 强弱 / 起运）在结果页已有文字块，这里不重复下结论；
 * - 所有取值都做类型守卫，缺字段就**不画**，不猜、不补零。
 */
import { computed } from 'vue'
import { GAN_WU_XING, WU_XING_LABEL, ZHI_WU_XING, type DiZhi, type TianGan, type WuXing } from '@/engine/calendar'

const props = defineProps<{ basis: Record<string, unknown> }>()

interface GanZhiLike {
  gan: string
  zhi: string
}
interface CangGanLike {
  gan: string
  layer: string
  shiShen: string
}
interface ShiShenLike {
  gan: string
  shiShen: string
}
interface DaYunStepLike {
  index: number
  ganZhi: string
  startAge: number
  endAge: number
}

type PillarKey = 'year' | 'month' | 'day' | 'time'

/** 类型守卫：把 unknown 收成干支结构，缺字段就地放弃 */
function asGanZhi(v: unknown): GanZhiLike | undefined {
  if (!v || typeof v !== 'object') return undefined
  const o = v as Record<string, unknown>
  const gan = o['gan']
  const zhi = o['zhi']
  return typeof gan === 'string' && typeof zhi === 'string' ? { gan, zhi } : undefined
}

const WU_XING_COLOR: Record<WuXing, string> = {
  wood: 'var(--wx-wood)',
  fire: 'var(--wx-fire)',
  earth: 'var(--wx-earth)',
  metal: 'var(--wx-metal)',
  water: 'var(--wx-water)'
}

function ganColor(gan: string): string | undefined {
  const wx = GAN_WU_XING[gan as TianGan]
  return wx ? WU_XING_COLOR[wx] : undefined
}
function zhiColor(zhi: string): string | undefined {
  const wx = ZHI_WU_XING[zhi as DiZhi]
  return wx ? WU_XING_COLOR[wx] : undefined
}

const pillars = computed<Record<PillarKey, GanZhiLike | undefined> | undefined>(() => {
  const p = props.basis['pillars']
  if (!p || typeof p !== 'object') return undefined
  const o = p as Record<string, unknown>
  const out = {
    year: asGanZhi(o['year']),
    month: asGanZhi(o['month']),
    day: asGanZhi(o['day']),
    time: asGanZhi(o['time'])
  }
  return out.year ? out : undefined
})

const shiShen = computed(() => {
  const s = props.basis['shiShen']
  if (!s || typeof s !== 'object') return undefined
  const o = s as Record<string, unknown>
  return {
    dayMaster: typeof o['dayMaster'] === 'string' ? (o['dayMaster'] as string) : '',
    byPillar: (o['byPillar'] ?? {}) as Record<string, ShiShenLike | undefined>,
    byBranch: (o['byBranch'] ?? {}) as Record<string, CangGanLike[] | undefined>
  }
})

const geJu = computed(() => {
  const g = props.basis['geJu']
  if (!g || typeof g !== 'object') return undefined
  const o = g as Record<string, unknown>
  const dist = o['wuXingDist']
  if (!dist || typeof dist !== 'object') return undefined
  const d = dist as Record<string, unknown>
  return {
    name: typeof o['geJu'] === 'string' ? (o['geJu'] as string) : '',
    dist: d
  }
})

/** 五行分布：按固定顺序出条，零值也画（"缺什么"同样是要看见的信息） */
const wuXingBars = computed(() => {
  const g = geJu.value
  if (!g) return []
  const order: WuXing[] = ['wood', 'fire', 'earth', 'metal', 'water']
  const counts = order.map((k) => {
    const raw = g.dist[k]
    return { key: k, label: WU_XING_LABEL[k], n: typeof raw === 'number' ? raw : 0 }
  })
  const max = Math.max(1, ...counts.map((c) => c.n))
  return counts.map((c) => ({ ...c, color: WU_XING_COLOR[c.key], pct: Math.round((c.n / max) * 100) }))
})

const daYun = computed(() => {
  const d = props.basis['daYun']
  if (!d || typeof d !== 'object') return undefined
  const o = d as Record<string, unknown>
  const steps = Array.isArray(o['steps']) ? (o['steps'] as unknown[]) : []
  const clean: DaYunStepLike[] = []
  for (const s of steps) {
    if (!s || typeof s !== 'object') continue
    const so = s as Record<string, unknown>
    if (
      typeof so['ganZhi'] === 'string' &&
      typeof so['startAge'] === 'number' &&
      typeof so['endAge'] === 'number'
    ) {
      clean.push({
        index: typeof so['index'] === 'number' ? so['index'] : clean.length + 1,
        ganZhi: so['ganZhi'],
        startAge: so['startAge'],
        endAge: so['endAge']
      })
    }
  }
  if (!clean.length) return undefined
  const qy = o['qiYun'] as Record<string, unknown> | undefined
  return {
    direction: o['direction'] === 'forward' ? '顺行' : o['direction'] === 'reverse' ? '逆行' : '',
    qiYun:
      qy && typeof qy['years'] === 'number'
        ? `${qy['years']} 岁 ${typeof qy['months'] === 'number' ? qy['months'] : 0} 个月起运`
        : '',
    steps: clean
  }
})

const COLUMNS: { key: PillarKey; name: string }[] = [
  { key: 'year', name: '年柱' },
  { key: 'month', name: '月柱' },
  { key: 'day', name: '日柱' },
  { key: 'time', name: '时柱' }
]

function cangGanOf(k: PillarKey): CangGanLike[] {
  return shiShen.value?.byBranch?.[k] ?? []
}
function shiShenOfPillar(k: PillarKey): string {
  return shiShen.value?.byPillar?.[k]?.shiShen ?? ''
}
</script>

<template>
  <div v-if="pillars" class="bazi">
    <!-- 四柱干支表：列＝四柱，行＝天干 / 地支 / 藏干 -->
    <div class="chart" role="table" aria-label="四柱干支">
      <div class="row head" role="row">
        <span class="rowname" role="columnheader"></span>
        <span v-for="c in COLUMNS" :key="c.key" class="colname" role="columnheader">
          {{ c.name }}
        </span>
      </div>

      <div class="row" role="row">
        <span class="rowname" role="rowheader">天干</span>
        <span v-for="c in COLUMNS" :key="c.key" class="cell" :class="{ day: c.key === 'day' }" role="cell">
          <b class="gz" :style="{ color: ganColor(pillars[c.key]!.gan) }">
            {{ pillars[c.key]!.gan }}
          </b>
          <em v-if="c.key !== 'day' && shiShenOfPillar(c.key)" class="ss">
            {{ shiShenOfPillar(c.key) }}
          </em>
          <em v-else-if="c.key === 'day'" class="ss dm">日主</em>
        </span>
      </div>

      <div class="row" role="row">
        <span class="rowname" role="rowheader">地支</span>
        <span v-for="c in COLUMNS" :key="c.key" class="cell" :class="{ day: c.key === 'day' }" role="cell">
          <b class="gz" :style="{ color: zhiColor(pillars[c.key]!.zhi) }">
            {{ pillars[c.key]!.zhi }}
          </b>
        </span>
      </div>

      <div class="row" role="row">
        <span class="rowname" role="rowheader">藏干</span>
        <span v-for="c in COLUMNS" :key="c.key" class="cell cang" role="cell">
          <template v-if="cangGanOf(c.key).length">
            <span v-for="h in cangGanOf(c.key)" :key="h.layer" class="cang-item">
              <i class="cg" :style="{ color: ganColor(h.gan) }">{{ h.gan }}</i>
              <i class="cs">{{ h.shiShen }}</i>
            </span>
          </template>
          <span v-else class="dash">—</span>
        </span>
      </div>
    </div>

    <!-- 五行分布：只呈现计数，不给"缺金需补"这类断语 -->
    <div v-if="wuXingBars.length" class="wuxing">
      <div class="cap">五行分布（天干 + 地支）</div>
      <div v-for="b in wuXingBars" :key="b.key" class="bar-row">
        <span class="bar-label" :style="{ color: b.color }">{{ b.label }}</span>
        <span class="bar-track">
          <span class="bar-fill" :style="{ width: `${b.pct}%`, background: b.color }"></span>
        </span>
        <span class="bar-n">{{ b.n }}</span>
      </div>
    </div>

    <!-- 大运：横向时间轴 -->
    <div v-if="daYun" class="dayun">
      <div class="cap">
        大运序列
        <span v-if="daYun.direction" class="tag">{{ daYun.direction }}</span>
        <span v-if="daYun.qiYun" class="tag">{{ daYun.qiYun }}</span>
      </div>
      <ol class="steps">
        <li v-for="s in daYun.steps" :key="s.index" class="step">
          <span class="step-age">{{ s.startAge }}–{{ s.endAge }}</span>
          <span class="step-gz">
            <i :style="{ color: ganColor(s.ganZhi[0]) }">{{ s.ganZhi[0] }}</i>
            <i :style="{ color: zhiColor(s.ganZhi[1]) }">{{ s.ganZhi[1] }}</i>
          </span>
        </li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.bazi {
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
  padding: 0.12rem;
  border-radius: var(--radius-s);
  background: var(--bg-2);
}
.chart {
  display: flex;
  flex-direction: column;
  gap: 0.02rem;
}
.row {
  display: grid;
  grid-template-columns: 0.44rem repeat(4, 1fr);
  align-items: center;
  gap: 0.02rem;
}
.row.head .colname {
  text-align: center;
  font-size: 0.11rem;
  color: var(--text-3);
}
.rowname {
  font-size: 0.11rem;
  color: var(--text-3);
}
.cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.01rem;
  padding: 0.04rem 0;
  border-radius: var(--radius-s);
  background: var(--panel);
  border: 1px solid transparent;
}
/* 日柱为主，做较轻的朱砂描边，提示这是元的落位（不给吉凶结论） */
.cell.day {
  border-color: var(--cinnabar-dim);
  background: linear-gradient(180deg, rgba(192, 72, 60, 0.1), var(--panel));
}
.gz {
  font-family: var(--font-serif);
  font-size: 0.22rem;
  line-height: 1.15;
  font-weight: 600;
}
.ss {
  font-style: normal;
  font-size: 0.1rem;
  color: var(--text-3);
}
.ss.dm {
  color: var(--cinnabar-bright);
}
.cell.cang {
  gap: 0.02rem;
  padding: 0.05rem 0.02rem;
  min-height: 0.56rem;
  justify-content: center;
}
.cang-item {
  display: flex;
  align-items: baseline;
  gap: 0.03rem;
  line-height: 1.2;
}
.cg {
  font-style: normal;
  font-size: 0.13rem;
  font-family: var(--font-serif);
}
.cs {
  font-style: normal;
  font-size: 0.1rem;
  color: var(--text-2);
}
.dash {
  color: var(--text-3);
  font-size: 0.12rem;
}
.cap {
  display: flex;
  align-items: center;
  gap: 0.06rem;
  font-size: 0.11rem;
  color: var(--text-2);
  margin-bottom: 0.06rem;
}
.tag {
  padding: 0 0.05rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--line-soft);
  color: var(--text-3);
  font-size: 0.1rem;
}
.wuxing {
  border-top: 1px dashed var(--line-soft);
  padding-top: 0.08rem;
}
.bar-row {
  display: grid;
  grid-template-columns: 0.2rem 1fr 0.18rem;
  align-items: center;
  gap: 0.06rem;
  padding: 0.02rem 0;
}
.bar-label {
  font-size: 0.12rem;
  font-family: var(--font-serif);
}
.bar-track {
  height: 0.075rem;
  border-radius: var(--radius-pill);
  background: var(--panel);
  box-shadow: inset 0 0 0 1px var(--line-soft);
  overflow: hidden;
}
.bar-fill {
  display: block;
  height: 100%;
  border-radius: var(--radius-pill);
  transition: width var(--dur-base) var(--ease-out);
  filter: drop-shadow(0 0 0.03rem currentColor);
}
.bar-n {
  font-size: 0.11rem;
  color: var(--text-2);
  text-align: right;
}
.dayun {
  border-top: 1px dashed var(--line-soft);
  padding-top: 0.08rem;
}
.steps {
  position: relative;
  display: flex;
  gap: 0.06rem;
  margin: 0.08rem 0 0;
  padding: 0.13rem 0 0.02rem;
  list-style: none;
  overflow-x: auto;
}
/* 大运时间轴：底部一条连线 + 每运一个发光节点 */
.steps::before {
  content: '';
  position: absolute;
  top: 0.06rem;
  left: 0.06rem;
  right: 0.06rem;
  height: 1px;
  background: var(--line);
}
.step {
  position: relative;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.01rem;
  min-width: 0.46rem;
  padding: 0.05rem 0.04rem 0.03rem;
  border-radius: var(--radius-s);
  background: var(--panel);
}
.step::before {
  content: '';
  position: absolute;
  top: -0.12rem;
  left: 50%;
  transform: translateX(-50%);
  width: 0.06rem;
  height: 0.06rem;
  border-radius: 50%;
  background: var(--bronze-bright);
  box-shadow: 0 0 0.05rem rgba(216, 189, 133, 0.75);
}
.step-age {
  font-size: 0.1rem;
  color: var(--text-3);
}
.step-gz {
  font-family: var(--font-serif);
  font-size: 0.15rem;
  letter-spacing: 0.01rem;
}
.step-gz i {
  font-style: normal;
}
</style>
