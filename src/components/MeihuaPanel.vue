<script setup lang="ts">
/**
 * 梅花体用互变盘（Y3-08）
 *
 * 数据来自引擎 `interpretation.basis.meihua`（只带结构与五行，UI 不依赖引擎内部类型）。
 *
 * 纪律：
 * - 体用关系（用生体 / 体克用 …）是**结构结论**，照实呈现；
 * - 关系本身带吉凶倾向，但**不在此展开断语** —— 断语属内容母版（Y3-09），
 *   未装载时上层走 L3 兜底。所以这里一律用中性配色，不给"吉 / 凶"的字样与红绿暗示。
 */
import { computed } from 'vue'
import { WU_XING_LABEL, type WuXing } from '@/engine/calendar'

interface TiYongSide {
  trigram: string
  element: WuXing
}

const props = defineProps<{ basis: Record<string, unknown> }>()

/** 八卦符号：字形在各平台都稳定，比图片省事 */
const TRIGRAM_GLYPH: Record<string, string> = {
  乾: '☰',
  兑: '☱',
  离: '☲',
  震: '☳',
  巽: '☴',
  坎: '☵',
  艮: '☶',
  坤: '☷'
}

/** 五行 → 配色 class（色值只在 tokens.css 里定义） */
const WX_CLASS: Record<WuXing, string> = {
  wood: 'wx-wood',
  fire: 'wx-fire',
  earth: 'wx-earth',
  metal: 'wx-metal',
  water: 'wx-water'
}

const meihua = computed(() => {
  const m = props.basis['meihua'] as
    | { ti?: TiYongSide; yong?: TiYongSide; relation?: string }
    | undefined
  if (!m?.ti?.trigram || !m?.yong?.trigram) return undefined
  return m
})

/** 互卦在 basis 里挂在 meihua 下（见引擎 meihuaBasis） */
const hu = computed(() => {
  const m = props.basis['meihua'] as { huGua?: { index?: number; name?: string } } | undefined
  const h = m?.huGua
  return h?.name ? `第 ${h.index} 卦 ${h.name}` : undefined
})

/** 变卦：本卦动爻互变后的卦，与体用同属排盘结构 */
const bian = computed(() => {
  const b = props.basis['bianGua'] as { index?: number; name?: string } | undefined
  return b?.name ? `第 ${b.index} 卦 ${b.name}` : undefined
})

/**
 * 关系箭头：表示"力量从哪边来"。
 * 用生体 / 用克体 → 用作用于体（指向左）；体生用 / 体克用 → 体作用于用（指向右）；
 * 比和 → 双向。
 */
const relation = computed(() => {
  const r = typeof meihua.value?.relation === 'string' ? meihua.value.relation : ''
  const glyph = r === '用生体' || r === '用克体' ? '←' : r === '比和' ? '⇄' : '→'
  return { text: r || '—', glyph }
})

function side(v: TiYongSide | undefined) {
  if (!v) return { glyph: '', name: '', element: '', cls: '' }
  return {
    glyph: TRIGRAM_GLYPH[v.trigram] ?? '',
    name: v.trigram,
    element: WU_XING_LABEL[v.element] ?? '',
    cls: WX_CLASS[v.element] ?? ''
  }
}
</script>

<template>
  <div v-if="meihua" class="meihua">
    <div class="cap">体用互变</div>

    <div class="ty" role="group" aria-label="体用五行关系">
      <div class="side">
        <span class="tag">体</span>
        <span class="glyph">{{ side(meihua.ti).glyph }}</span>
        <span class="tri">{{ side(meihua.ti).name }}</span>
        <span class="el" :class="side(meihua.ti).cls">{{ side(meihua.ti).element }}</span>
      </div>

      <div class="rel">
        <span class="arrow" aria-hidden="true">{{ relation.glyph }}</span>
        <span class="rel-txt">{{ relation.text }}</span>
      </div>

      <div class="side">
        <span class="tag tag-yong">用</span>
        <span class="glyph">{{ side(meihua.yong).glyph }}</span>
        <span class="tri">{{ side(meihua.yong).name }}</span>
        <span class="el" :class="side(meihua.yong).cls">{{ side(meihua.yong).element }}</span>
      </div>
    </div>

    <ul class="gua-list">
      <li>
        <span class="k">互卦</span>
        <span class="v">{{ hu ?? '—' }}</span>
      </li>
      <li>
        <span class="k">变卦</span>
        <span class="v">{{ bian ?? '无动爻，不变' }}</span>
      </li>
    </ul>

    <p class="note">体＝我，用＝所问之事；箭头表示五行力量的来向。体用吉凶断语属内容母版，未装载时不作评断。</p>
  </div>
</template>

<style scoped>
.meihua {
  margin: 0.08rem 0;
  padding: 0.1rem;
  border-radius: var(--radius-s);
  background: var(--bg-2);
  border: 1px solid var(--line-soft);
}
.cap {
  font-size: 0.11rem;
  color: var(--text-2);
  margin-bottom: 0.07rem;
}
.ty {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 0.06rem;
}
.side {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.01rem;
  padding: 0.06rem 0.04rem;
  border-radius: var(--radius-s);
  border: 1px solid var(--line-soft);
  background: var(--panel);
}
.tag {
  font-size: 0.09rem;
  line-height: 1.5;
  padding: 0 0.04rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--cinnabar-dim);
  color: var(--cinnabar-bright);
}
.tag-yong {
  border-color: var(--bronze-dim);
  color: var(--bronze-bright);
}
.glyph {
  font-size: 0.2rem;
  line-height: 1.1;
  color: var(--text);
}
.tri {
  font-family: var(--font-serif);
  font-size: 0.13rem;
  color: var(--text);
}
.el {
  font-size: 0.11rem;
}
.rel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.01rem;
  min-width: 0.5rem;
}
.arrow {
  font-size: 0.14rem;
  color: var(--bronze-bright);
}
.rel-txt {
  font-family: var(--font-serif);
  font-size: 0.11rem;
  color: var(--text-2);
  white-space: nowrap;
}
.gua-list {
  list-style: none;
  margin: 0.08rem 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.04rem 0.14rem;
}
.gua-list li {
  display: flex;
  align-items: baseline;
  gap: 0.05rem;
  font-size: 0.12rem;
}
.k {
  color: var(--text-3);
  font-size: 0.11rem;
}
.v {
  color: var(--text);
}
.note {
  font-size: 0.1rem;
  color: var(--text-3);
  line-height: 1.7;
  margin: 0.07rem 0 0;
}
.wx-wood {
  color: var(--wx-wood);
}
.wx-fire {
  color: var(--wx-fire);
}
.wx-earth {
  color: var(--wx-earth);
}
.wx-metal {
  color: var(--wx-metal);
}
.wx-water {
  color: var(--wx-water);
}
</style>
