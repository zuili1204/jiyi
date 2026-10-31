<script setup lang="ts">
/**
 * 六爻纳甲表（Y3-06 / Y3-07 的可视化）
 *
 * 数据只从 `interpretation.basis.najia` / `.wangShuai` 取，**不接触用户输入**。
 *
 * 纪律：
 * - 表格只呈现**装卦结构与旺衰分项**，一列断语都不写（断语属内容母版 Y3-09）；
 * - 装卦表未核校、旺衰分数口径暂定 —— 两处口径都由结果页的文字块负责声明，
 *   这里不重复下结论，也不把 `level` 包装成吉凶。
 * - 爻位**自上而下**画（六爻在最上），与排盘习惯一致。
 */
import { computed } from 'vue'

const props = defineProps<{ basis: Record<string, unknown> }>()

interface YaoRow {
  position: number
  gan: string
  zhi: string
  liuQin: string
  shi: boolean
  ying: boolean
  moving: boolean
  changedZhi?: string
  changedLiuQin?: string
  /** 来自 basis.wangShuai，按爻位对齐 */
  yue?: string
  ri?: string
  yuePo?: boolean
  riChong?: string
  kongWang?: boolean
  level?: string
}

/** 五行 → 配色（六爻体系的五行是中文字面量） */
const WX_COLOR: Record<string, string> = {
  木: 'var(--wx-wood)',
  火: 'var(--wx-fire)',
  土: 'var(--wx-earth)',
  金: 'var(--wx-metal)',
  水: 'var(--wx-water)'
}

/** 地支五行：六爻只用于着色，故单独列出而不引入引擎内部表 */
const ZHI_WX: Record<string, string> = {
  子: '水',
  亥: '水',
  寅: '木',
  卯: '木',
  巳: '火',
  午: '火',
  申: '金',
  酉: '金',
  辰: '土',
  戌: '土',
  丑: '土',
  未: '土'
}

function colorOfZhi(zhi: string): string | undefined {
  const wx = ZHI_WX[zhi]
  return wx ? WX_COLOR[wx] : undefined
}

const najia = computed(() => {
  const n = props.basis['najia']
  if (!n || typeof n !== 'object') return undefined
  const o = n as Record<string, unknown>
  const raw = Array.isArray(o['yao']) ? (o['yao'] as unknown[]) : []
  const rows: YaoRow[] = []
  for (const y of raw) {
    if (!y || typeof y !== 'object') continue
    const yo = y as Record<string, unknown>
    if (typeof yo['position'] !== 'number' || typeof yo['zhi'] !== 'string') continue
    const changed = yo['changed'] as Record<string, unknown> | undefined
    rows.push({
      position: yo['position'],
      gan: typeof yo['gan'] === 'string' ? (yo['gan'] as string) : '',
      zhi: yo['zhi'] as string,
      liuQin: typeof yo['liuQin'] === 'string' ? (yo['liuQin'] as string) : '',
      shi: yo['shi'] === true,
      ying: yo['ying'] === true,
      moving: yo['moving'] === true,
      changedZhi: changed && typeof changed['zhi'] === 'string' ? (changed['zhi'] as string) : undefined,
      changedLiuQin:
        changed && typeof changed['liuQin'] === 'string' ? (changed['liuQin'] as string) : undefined
    })
  }
  if (rows.length !== 6) return undefined
  return {
    gong: typeof o['gong'] === 'string' ? (o['gong'] as string) : '',
    gongElement: typeof o['gongElement'] === 'string' ? (o['gongElement'] as string) : '',
    shiYao: typeof o['shiYao'] === 'number' ? (o['shiYao'] as number) : 0,
    yingYao: typeof o['yingYao'] === 'number' ? (o['yingYao'] as number) : 0,
    rows
  }
})

const wangShuai = computed(() => {
  const w = props.basis['wangShuai']
  if (!w || typeof w !== 'object') return undefined
  const o = w as Record<string, unknown>
  const raw = Array.isArray(o['yao']) ? (o['yao'] as unknown[]) : []
  const map = new Map<number, Record<string, unknown>>()
  for (const y of raw) {
    if (!y || typeof y !== 'object') continue
    const yo = y as Record<string, unknown>
    if (typeof yo['position'] === 'number') map.set(yo['position'], yo)
  }
  return {
    yueZhi: typeof o['yueZhi'] === 'string' ? (o['yueZhi'] as string) : '',
    riZhi: typeof o['riZhi'] === 'string' ? (o['riZhi'] as string) : '',
    kongWang: Array.isArray(o['kongWang']) ? (o['kongWang'] as string[]) : [],
    map
  }
})

/** 自下而上的爻位 → 自上而下展示 */
const tableRows = computed(() => {
  const n = najia.value
  if (!n) return []
  return [...n.rows].reverse().map((r) => {
    const w = wangShuai.value?.map.get(r.position)
    return {
      ...r,
      yue: typeof w?.['yue'] === 'string' ? (w['yue'] as string) : undefined,
      ri: typeof w?.['ri'] === 'string' ? (w['ri'] as string) : undefined,
      yuePo: w?.['yuePo'] === true,
      riChong: typeof w?.['riChong'] === 'string' ? (w['riChong'] as string) : undefined,
      kongWang: w?.['kongWang'] === true,
      level: typeof w?.['level'] === 'string' ? (w['level'] as string) : undefined
    }
  })
})

function flags(r: YaoRow): string[] {
  const out: string[] = []
  if (r.yuePo) out.push('月破')
  if (r.riChong === '暗动') out.push('暗动')
  if (r.riChong === '日破') out.push('日破')
  if (r.kongWang) out.push('旬空')
  return out
}
</script>

<template>
  <div v-if="najia" class="liuyao">
    <div class="meta">
      <span class="meta-cap">纳甲六亲</span>
      <span class="meta-txt">
        {{ najia.gong }}宫（{{ najia.gongElement }}）
        <template v-if="najia.shiYao"> · 世在 {{ najia.shiYao }} 爻 · 应在 {{ najia.yingYao }} 爻</template>
      </span>
    </div>

    <table class="tbl">
      <thead>
        <tr>
          <th scope="col">爻</th>
          <th scope="col">纳甲</th>
          <th scope="col">六亲</th>
          <th scope="col">世应</th>
          <th scope="col">动变</th>
          <th v-if="wangShuai" scope="col">旺衰</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in tableRows" :key="r.position" :class="{ moving: r.moving }">
          <td class="pos">{{ r.position }}</td>
          <td class="najia-cell">
            <span class="zhi" :style="{ color: colorOfZhi(r.zhi) }">{{ r.zhi }}</span>
            <span class="gan">{{ r.gan }}</span>
          </td>
          <td class="qin">{{ r.liuQin }}</td>
          <td class="sy">
            <span v-if="r.shi" class="badge shi">世</span>
            <span v-else-if="r.ying" class="badge ying">应</span>
            <span v-else class="none">·</span>
          </td>
          <td class="change">
            <template v-if="r.changedZhi">
              <span class="arrow">→</span>
              <span class="zhi" :style="{ color: colorOfZhi(r.changedZhi) }">{{ r.changedZhi }}</span>
              <span class="qin-sm">{{ r.changedLiuQin }}</span>
            </template>
            <span v-else class="none">·</span>
          </td>
          <td v-if="wangShuai" class="ws">
            <span v-if="r.level" class="level" :class="`lv-${r.level}`">{{ r.level }}</span>
            <span v-if="r.yue" class="ws-sub">{{ r.yue }}/{{ r.ri }}</span>
            <span v-for="f in flags(r)" :key="f" class="flag">{{ f }}</span>
          </td>
        </tr>
      </tbody>
    </table>

    <p v-if="wangShuai" class="ws-meta">
      月建 {{ wangShuai.yueZhi }} · 日辰 {{ wangShuai.riZhi
      }}<template v-if="wangShuai.kongWang.length"> · 旬空 {{ wangShuai.kongWang.join('、') }}</template>
    </p>
  </div>
</template>

<style scoped>
.liuyao {
  padding: 0.1rem;
  border-radius: var(--radius-s);
  background: var(--bg-2);
  overflow-x: auto;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.06rem;
  margin-bottom: 0.06rem;
}
.meta-cap {
  font-family: var(--font-serif);
  font-size: 0.13rem;
  color: var(--text);
}
.meta-txt {
  font-size: 0.11rem;
  color: var(--text-3);
}
.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.12rem;
}
.tbl th {
  padding: 0.04rem 0.03rem;
  font-weight: 400;
  font-size: 0.1rem;
  color: var(--text-3);
  text-align: left;
  border-bottom: 1px solid var(--line-soft);
}
.tbl td {
  padding: 0.045rem 0.03rem;
  color: var(--text-2);
  border-bottom: 1px dashed var(--line-soft);
  vertical-align: middle;
  white-space: nowrap;
}
.tbl tr:last-child td {
  border-bottom: none;
}
.tbl tr.moving td {
  background: color-mix(in srgb, var(--cinnabar) 8%, transparent);
}
/* 动爻：爻位数字用朱砂强调，一眼看到变点（非吉凶） */
.tbl tr.moving .pos {
  color: var(--cinnabar-bright);
  font-weight: 600;
}
.pos {
  color: var(--text-3);
  width: 0.2rem;
  font-family: var(--font-serif);
}
.najia-cell {
  display: flex;
  align-items: baseline;
  gap: 0.03rem;
}
.zhi {
  font-family: var(--font-serif);
  font-size: 0.17rem;
}
.gan {
  font-size: 0.1rem;
  color: var(--text-3);
}
.qin {
  font-family: var(--font-serif);
  color: var(--text);
}
.sy {
  width: 0.32rem;
}
.badge {
  display: inline-block;
  min-width: 0.24rem;
  padding: 0 0.03rem;
  border-radius: var(--radius-s);
  font-size: 0.1rem;
  text-align: center;
}
.badge.shi {
  color: #fff;
  background: var(--cinnabar);
}
.badge.ying {
  color: var(--text-2);
  border: 1px solid var(--line-soft);
}
.none {
  color: var(--text-3);
}
.change {
  font-size: 0.11rem;
}
.arrow {
  color: var(--text-3);
  margin-right: 0.02rem;
}
.qin-sm {
  font-size: 0.1rem;
  color: var(--text-3);
  margin-left: 0.02rem;
}
.ws {
  font-size: 0.11rem;
}
.level {
  margin-right: 0.03rem;
}
.lv-旺 {
  color: var(--wx-wood);
}
.lv-衰 {
  color: var(--wx-fire);
}
.lv-平 {
  color: var(--text-3);
}
.ws-sub {
  color: var(--text-3);
}
.flag {
  margin-left: 0.03rem;
  padding: 0 0.04rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--line-soft);
  font-size: 0.09rem;
  color: var(--text-2);
}
.ws-meta {
  margin: 0.06rem 0 0;
  font-size: 0.1rem;
  color: var(--text-3);
}
</style>
