<script setup lang="ts">
/**
 * 紫微十二宫盘（Y5-01 / Y5-02 / Y5-03 的可视化）
 *
 * 版面用**地支固定盘**：无论命宫落哪，宫位永远按地支排布（巳午未申 / 辰…酉 /
 * 卯…戌 / 寅丑子亥），十二宫名跟着地支走 —— 用户换盘不用重新认位置。
 *
 * 数据全部取自 `interpretation.basis`（引擎落库的排盘依据）：
 * - `mingGong`    命宫干支 / 五行局 / 十二宫名
 * - `zhuXing`     十四主曜落宫（mainStars）
 * - `siHuaByPalace` 四化按宫落位（只显示能定位的单）；辅星落宫的等补全
 * - `daXian`      大限（未提供性别时不出）
 *
 * 纪律：
 * - 中宫只列**已落地**的信息；辅煞 / 杂曜（Y5-03/06）未落地 → 如实标注「待核校」，不画假星；
 * - 不出现任何吉凶评断。
 */
import { computed } from 'vue'

const props = defineProps<{ basis: Record<string, unknown> }>()

interface GongLike {
  name: string
  branch: string
}

/**
 * 地支固定盘位：显式给出网格坐标，绝不依赖自动排布。
 * 中宫占 (2,2)–(3,3)，若改成依赖 auto-placement，12 宫会绕开中宫后溢出成第 5 行。
 */
const RING_CELLS: { zhi: string; row: number; col: number }[] = [
  { zhi: '巳', row: 1, col: 1 },
  { zhi: '午', row: 1, col: 2 },
  { zhi: '未', row: 1, col: 3 },
  { zhi: '申', row: 1, col: 4 },
  { zhi: '辰', row: 2, col: 1 },
  { zhi: '酉', row: 2, col: 4 },
  { zhi: '卯', row: 3, col: 1 },
  { zhi: '戌', row: 3, col: 4 },
  { zhi: '寅', row: 4, col: 1 },
  { zhi: '丑', row: 4, col: 2 },
  { zhi: '子', row: 4, col: 3 },
  { zhi: '亥', row: 4, col: 4 }
]

const mingGong = computed(() => {
  const m = props.basis['mingGong']
  if (!m || typeof m !== 'object') return undefined
  const o = m as Record<string, unknown>
  const gong = Array.isArray(o['twelveGong']) ? (o['twelveGong'] as unknown[]) : []
  const twelve: GongLike[] = []
  for (const g of gong) {
    if (!g || typeof g !== 'object') continue
    const go = g as Record<string, unknown>
    if (typeof go['name'] === 'string' && typeof go['branch'] === 'string') {
      twelve.push({ name: go['name'], branch: go['branch'] })
    }
  }
  if (twelve.length !== 12) return undefined
  const ju = o['wuXingJu'] as Record<string, unknown> | undefined
  return {
    branch: typeof o['branch'] === 'string' ? (o['branch'] as string) : '',
    ganZhi: typeof o['ganZhi'] === 'string' ? (o['ganZhi'] as string) : '',
    ju: ju && typeof ju['label'] === 'string' ? (ju['label'] as string) : '',
    twelve
  }
})

const siHua = computed(() => {
  const s = props.basis['siHua']
  if (!s || typeof s !== 'object') return undefined
  const o = s as Record<string, unknown>
  const pick = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : '')
  const yearGan = pick('yearGan')
  const rows = [
    { kind: '禄', star: pick('lu') },
    { kind: '权', star: pick('quan') },
    { kind: '科', star: pick('ke') },
    { kind: '忌', star: pick('ji') }
  ].filter((r) => r.star)
  return rows.length === 4 ? { yearGan, rows } : undefined
})

/** 十四主星：`地支 → 星名[]`（空宫为空数组） */
const zhuXing = computed(() => {
  const z = props.basis['zhuXing']
  if (!z || typeof z !== 'object') return undefined
  const ms = (z as Record<string, unknown>)['mainStars']
  if (!ms || typeof ms !== 'object') return undefined
  const map: Record<string, string[]> = {}
  for (const [branch, arr] of Object.entries(ms as Record<string, unknown>)) {
    if (Array.isArray(arr)) map[branch] = arr.filter((x): x is string => typeof x === 'string')
  }
  return { map }
})

/** 辅煞 + 杂曜：地支 → 星名[]（辅在前、杂在后，小字） */
const fuXing = computed(() => {
  const fu = props.basis['fuXing']
  const za = props.basis['zaYao']
  if ((!fu && !za) || (typeof fu !== 'object' && typeof za !== 'object')) return undefined
  const map: Record<string, string[]> = {}
  const read = (src: unknown) => {
    if (!src || typeof src !== 'object') return
    for (const [branch, arr] of Object.entries(src as Record<string, unknown>)) {
      if (Array.isArray(arr)) {
        map[branch] = [
          ...(map[branch] ?? []),
          ...arr.filter((x): x is string => typeof x === 'string')
        ]
      }
    }
  }
  read(fu)
  read(za)
  return { map }
})

/** 四化落宫：年 → {化, 星}，kind 决定配色（禄金 / 权朱 / 科水 / 忌灰） */
interface SiHuaCell {
  kind: string
  label: string
  star: string
}
const siHuaPalace = computed(() => {
  const arr = props.basis['siHuaByPalace']
  if (!Array.isArray(arr)) return undefined
  const byBranch = new Map<string, SiHuaCell>()
  for (const it of arr) {
    if (!it || typeof it !== 'object') continue
    const o = it as Record<string, unknown>
    if (typeof o['palace'] === 'string' && o['palace'] && typeof o['kind'] === 'string') {
      byBranch.set(o['palace'] as string, {
        kind: o['kind'] as string,
        label: typeof o['label'] === 'string' ? (o['label'] as string) : (o['kind'] as string),
        star: typeof o['star'] === 'string' ? (o['star'] as string) : ''
      })
    }
  }
  return byBranch
})

/** 四化配色：禄金辉、权朱砂、科水墨、忌暗。只作着色，不作吉凶评断。 */
const SI_HUA_CLASS: Record<string, string> = {
  lu: 'sh-lu',
  quan: 'sh-quan',
  ke: 'sh-ke',
  ji: 'sh-ji'
}
function siHuaCls(kind: string): string {
  return SI_HUA_CLASS[kind] ?? 'sh-ji'
}

/** 地支 → 宫名 */
const gongByBranch = computed(() => {
  const m = new Map<string, string>()
  for (const g of mingGong.value?.twelve ?? []) m.set(g.branch, g.name)
  return m
})

function gongOf(branch: string): string {
  return gongByBranch.value.get(branch) ?? ''
}
</script>

<template>
  <div v-if="mingGong" class="ziwei">
    <div class="pan" role="table" aria-label="紫微十二宫盘">
      <!-- 中宫：只放已落地的信息；未落地的星曜留空并注明 -->
      <div class="center" role="cell">
        <div class="center-main">
          <span class="center-gz">{{ mingGong.ganZhi }}</span>
          <span class="center-ju">{{ mingGong.ju }}</span>
        </div>
        <div v-if="siHua" class="sihua">
          <span class="sihua-cap">{{ siHua.yearGan }}干四化</span>
          <span v-for="r in siHua.rows" :key="r.kind" class="sihua-item">
            <i class="sihua-kind">{{ r.kind }}</i>{{ r.star }}
          </span>
        </div>
        <p class="center-note">部分杂曜暂按通行口径呈现，详情以正式发布说明为准。</p>
      </div>

      <div
        v-for="c in RING_CELLS"
        :key="c.zhi"
        class="cell"
        role="cell"
        :class="{ ming: c.zhi === mingGong.branch }"
        :style="{ gridRow: String(c.row), gridColumn: String(c.col) }"
      >
        <span class="cell-gong">{{ gongOf(c.zhi) }}</span>
        <span class="cell-zhi">{{ c.zhi }}</span>
        <span v-if="zhuXing?.map[c.zhi]?.length" class="cell-stars">
          <i v-for="(s, i) in zhuXing.map[c.zhi]" :key="i" class="star">{{ s }}</i>
        </span>
        <span v-if="fuXing?.map[c.zhi]?.length" class="cell-aux">
          <i v-for="(s, i) in fuXing.map[c.zhi]" :key="i" class="aux">{{ s }}</i>
        </span>
        <span v-if="siHuaPalace?.get(c.zhi)" class="cell-sihua">
          <i class="sh" :class="siHuaCls(siHuaPalace.get(c.zhi)!.kind)">
            {{ siHuaPalace.get(c.zhi)!.label }}{{ siHuaPalace.get(c.zhi)!.star }}
          </i>
        </span>
        <span v-if="c.zhi === mingGong.branch" class="cell-flag">命宫</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ziwei {
  padding: 0.1rem;
  border-radius: var(--radius-s);
  background:
    radial-gradient(circle at 50% 40%, rgba(168, 137, 79, 0.05), transparent 60%),
    var(--bg-2);
  border: 1px solid var(--line-soft);
  position: relative;
}
.pan {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: minmax(0.78rem, auto);
  gap: 0.02rem;
  border: 1px solid var(--bronze-dim);
  border-radius: var(--radius);
  padding: 0.02rem;
  background: linear-gradient(180deg, rgba(168, 137, 79, 0.06), transparent 40%);
}
.cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 0.01rem;
  padding: 0.03rem 0.02rem;
  border-radius: var(--radius-s);
  background: var(--panel);
  border: 1px solid var(--line-soft);
}
.cell.ming {
  border-color: var(--cinnabar);
  background:
    radial-gradient(closest at 50% 20%, rgba(192, 72, 60, 0.16), transparent 70%),
    var(--bg);
  box-shadow: inset 0 0 0.1rem rgba(192, 72, 60, 0.14);
}
.cell-gong {
  font-size: 0.11rem;
  color: var(--text-2);
  line-height: 1.2;
}
.cell.ming .cell-gong {
  color: var(--cinnabar-bright);
  font-weight: 600;
}
.cell-zhi {
  font-family: var(--font-serif);
  font-size: 0.15rem;
  color: var(--text);
  line-height: 1.15;
}
.cell-stars {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.01rem 0.03rem;
  font-size: 0.1rem;
  line-height: 1.5;
}
.star {
  color: var(--bronze-bright);
  white-space: nowrap;
  font-weight: 500;
  letter-spacing: 0.02em;
}
.cell-sihua {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.01rem 0.03rem;
  font-size: 0.09rem;
  line-height: 1.4;
}
.sh {
  font-style: normal;
  white-space: nowrap;
}
/* 四化分色：禄金 / 权朱 / 科水 / 忌灰（只作着色标记，非吉凶评断） */
.sh-lu {
  color: var(--bronze-bright);
}
.sh-quan {
  color: var(--cinnabar-bright);
}
.sh-ke {
  color: var(--wx-water);
}
.sh-ji {
  color: var(--text-3);
}
/* 辅煞：浅灰小字，排在主星之下，不抢主星 */
.cell-aux {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.01rem 0.03rem;
  font-size: 0.085rem;
  line-height: 1.4;
}
.aux {
  color: var(--text-3);
  white-space: nowrap;
}
.cell-flag {
  font-size: 0.09rem;
  color: var(--cinnabar-bright);
}
.center {
  grid-column: 2 / span 2;
  grid-row: 2 / span 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.04rem;
  padding: 0.08rem 0.06rem;
  border-radius: var(--radius-s);
  background:
    radial-gradient(closest at 50% 30%, rgba(192, 72, 60, 0.1), transparent 72%),
    var(--panel);
  border-top: 1px solid var(--cinnabar-dim);
  text-align: center;
}
.center-main {
  display: flex;
  align-items: baseline;
  gap: 0.06rem;
}
.center-gz {
  font-family: var(--font-serif);
  font-size: 0.2rem;
  color: var(--text);
}
.center-ju {
  font-size: 0.12rem;
  color: var(--text-2);
}
.sihua {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.04rem 0.06rem;
}
.sihua-cap {
  font-size: 0.1rem;
  color: var(--text-3);
}
.sihua-item {
  font-size: 0.11rem;
  color: var(--text-2);
}
.sihua-kind {
  font-style: normal;
  color: var(--cinnabar-bright);
  margin-right: 0.01rem;
}
.center-note {
  margin: 0;
  font-size: 0.09rem;
  line-height: 1.5;
  color: var(--text-3);
}
</style>