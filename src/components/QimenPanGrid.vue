<script setup lang="ts">
/**
 * 奇门九宫格（Y6-05）
 *
 * 数据来自引擎 `interpretation.basis.qimenPan`（宫序结构，UI 不依赖引擎内部类型）。
 * 纪律：只展示排盘结构（地盘干 / 天盘干 / 星 / 门 / 八神，以及值符值使 / 空亡 / 马星**落宫**），
 * **不画吉凶断语** —— 空亡与马星是位置标记，不是吉凶判断。
 * 图例中如实标注"天盘 / 八神 / 空亡取法待核校"，避免读者把暂定口径当成定论。
 */
import { computed } from 'vue'

interface PanCell {
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
}

const props = defineProps<{ cells: PanCell[] }>()

/** 洛书九宫 3×3 布局：洛书数 → [行, 列] */
const LUO_POS: Record<number, [number, number]> = {
  4: [0, 0],
  9: [0, 1],
  2: [0, 2],
  3: [1, 0],
  5: [1, 1],
  7: [1, 2],
  8: [2, 0],
  1: [2, 1],
  6: [2, 2]
}

const grid = (() => {
  const g: (PanCell | null)[][] = [
    [null, null, null],
    [null, null, null],
    [null, null, null]
  ]
  for (const c of props.cells) {
    const pos = LUO_POS[c.palace]
    if (pos) g[pos[0]][pos[1]] = c
  }
  return g
})()

/** 有标记才出图例，没有就不说空话 */
const hasFlags = computed(() =>
  props.cells.some((c) => c.isZhiFu || c.isZhiShi || c.isKong || c.isMa)
)
</script>

<template>
  <div class="qimen-pan" role="img" aria-label="奇门九宫盘">
    <div v-for="(row, r) in grid" :key="r" class="row">
      <div
        v-for="(c, ci) in row"
        :key="ci"
        class="cell"
        :class="{ center: c?.palace === 5, 'is-kong': c?.isKong, 'is-zf': c?.isZhiFu }"
      >
        <template v-if="c">
          <div class="head">
            <span class="pname">{{ c.name }}</span>
            <span class="pnum">{{ c.palace }}</span>
          </div>
          <div v-if="c.isZhiFu || c.isZhiShi || c.isKong || c.isMa" class="flags">
            <span v-if="c.isZhiFu" class="flag flag-zf">值符</span>
            <span v-if="c.isZhiShi" class="flag flag-zs">值使</span>
            <span v-if="c.isKong" class="flag flag-kw">空</span>
            <span v-if="c.isMa" class="flag flag-ma">马</span>
          </div>
          <div class="heaven">{{ c.heavenlyGan }}</div>
          <div class="star">{{ c.star }}</div>
          <div class="door" v-if="c.door">{{ c.door }}门</div>
          <div class="god" v-if="c.god">{{ c.god }}</div>
          <div class="earth">{{ c.earthlyGan }}</div>
        </template>
      </div>
    </div>
    <p class="legend">
      每宫：上行为天盘干，中行为星，其下为门 / 八神，下行为地盘干。
    </p>
    <p v-if="hasFlags" class="legend legend-flags">
      <span class="flag flag-zf">值符</span> 值符星落宫 ·
      <span class="flag flag-zs">值使</span> 值使门落宫 ·
      <span class="flag flag-kw">空</span> 时旬空亡落宫（虚线框）·
      <span class="flag flag-ma">马</span> 驿马落宫。
    </p>
    <p class="legend">
            定局法按拆补法呈现，天盘、八神与空亡取法采用通行的转盘奇门口径。
          </p>
  </div>
</template>

<style scoped>
.qimen-pan {
  margin: 0.08rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.04rem;
}
.row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.04rem;
}
.cell {
  min-height: 0.92rem;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-s);
  background: var(--bg-2);
  padding: 0.04rem 0.05rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.01rem;
}
.cell.center {
  border-color: var(--cinnabar-dim);
  background: linear-gradient(180deg, rgba(192, 72, 60, 0.12), var(--bg-2));
}
/* 值符落宫：实线朱砂描边（"符"为盘眼） */
.cell.is-zf {
  border-color: var(--cinnabar-bright);
  background: linear-gradient(180deg, rgba(192, 72, 60, 0.1), var(--bg-2));
  box-shadow: inset 0 0 0.09rem rgba(192, 72, 60, 0.12);
}
/* 空亡落宫：虚线框，一眼看出"此处落空" */
.cell.is-kong {
  border-style: dashed;
  border-color: var(--text-3);
  opacity: 0.82;
}
.head {
  display: flex;
  justify-content: space-between;
  width: 100%;
  font-size: 0.1rem;
  color: var(--text-3);
}
.pname {
  font-family: var(--font-serif);
}
.flags {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.02rem;
  min-height: 0.11rem;
}
.flag {
  font-size: 0.09rem;
  line-height: 1.5;
  padding: 0 0.03rem;
  border-radius: var(--radius-pill);
  border: 1px solid currentColor;
  white-space: nowrap;
}
.flag-zf {
  color: var(--cinnabar-bright);
}
.flag-zs {
  color: var(--bronze-bright);
}
.flag-kw {
  color: var(--text-3);
}
.flag-ma {
  color: var(--warn);
}
.heaven {
  font-size: 0.2rem;
  font-family: var(--font-serif);
  color: var(--cinnabar-bright);
  line-height: 1.1;
}
.star {
  font-size: 0.12rem;
  color: var(--text);
}
.door {
  font-size: 0.11rem;
  color: var(--bronze-bright);
}
.god {
  font-size: 0.1rem;
  color: var(--text-2);
}
.earth {
  font-size: 0.12rem;
  color: var(--text-3);
  line-height: 1.1;
}
.legend {
  font-size: 0.1rem;
  color: var(--text-3);
  line-height: 1.7;
  margin: 0.02rem 0 0;
}
.legend-flags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.03rem;
}
</style>
