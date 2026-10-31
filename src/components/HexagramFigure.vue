<script setup lang="ts">
import { computed } from 'vue'

/**
 * 六爻卦象图（Y3-10 后续）
 *
 * 口径：
 * - 爻序自下而上（下标 0 = 初爻），**渲染时自上而下**（上爻在最上）；
 * - 阳爻一画、阴爻两画；动爻在右侧标 ○（老阳）/ ×（老阴）；
 * - 只做**呈现**，不做任何吉凶判断。
 */
const props = withDefaults(
  defineProps<{
    lines: boolean[]
    dongYao?: number[]
    /** 卦名（可选，显示在图下方） */
    name?: string
    /** 上下卦名（可选） */
    upper?: string
    lower?: string
    /** 标题（可选，如「本卦」「之卦」） */
    caption?: string
  }>(),
  { dongYao: () => [] }
)

/** 渲染顺序：上爻 → 初爻 */
const rows = computed(() => {
  const src = props.lines
  if (src.length !== 6) return []
  return [5, 4, 3, 2, 1, 0].map((i) => ({
    position: i + 1,
    yang: src[i],
    moving: props.dongYao.includes(i + 1)
  }))
})
</script>

<template>
  <figure class="hex">
    <figcaption v-if="caption" class="cap">{{ caption }}</figcaption>
    <div class="yaos">
      <div v-for="r in rows" :key="r.position" class="yao" :class="{ moving: r.moving }">
        <span v-if="r.yang" class="bar full" />
        <template v-else>
          <span class="bar half" />
          <span class="bar half" />
        </template>
        <span v-if="r.moving" class="mark" :aria-label="r.yang ? '老阳动爻' : '老阴动爻'">
          {{ r.yang ? '○' : '×' }}
        </span>
      </div>
    </div>
    <p v-if="name" class="name">
      {{ name }}<span v-if="upper && lower" class="tri">（上{{ upper }}下{{ lower }}）</span>
    </p>
  </figure>
</template>

<style scoped>
.hex {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.05rem;
  margin: 0.02rem 0 0.1rem;
}
.cap {
  font-family: var(--font-serif);
  font-size: 0.12rem;
  color: var(--bronze-bright);
  letter-spacing: 0.08em;
}
.yaos {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  width: 100%;
  max-width: 1.5rem;
}
.yao {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.06rem;
  min-height: 0.14rem;
}
.bar {
  height: 0.05rem;
  border-radius: 0.02rem;
  background: linear-gradient(90deg, var(--text), var(--text-2));
  box-shadow: 0 0 0.04rem rgba(236, 232, 241, 0.16);
}
.bar.full {
  width: 100%;
}
.bar.half {
  width: 40%;
}
.yao.moving .bar {
  background: linear-gradient(90deg, var(--cinnabar-bright), var(--cinnabar));
  box-shadow: 0 0 0.05rem rgba(192, 72, 60, 0.4);
}
.mark {
  width: 0.14rem;
  font-size: 0.12rem;
  line-height: 1;
  color: var(--cinnabar-bright);
  text-align: left;
  text-shadow: 0 0 0.04rem rgba(192, 72, 60, 0.5);
}
.name {
  font-family: var(--font-serif);
  font-size: 0.13rem;
  color: var(--text);
}
.tri {
  color: var(--text-3);
  font-size: 0.11rem;
}
</style>
