<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, type Component } from 'vue'
import {
  introItems,
  methods,
  guideEntries,
  figureItems,
  operationEntries,
  compliance
} from '@/data/content/tutorial'
import { loadOnboarding } from '@/platform/storage'
import TutorialSection from '@/components/tutorial/TutorialSection.vue'
import MethodCard from '@/components/tutorial/MethodCard.vue'
import ScenarioPicker from '@/components/tutorial/ScenarioPicker.vue'
import AccordionSection from '@/components/tutorial/AccordionSection.vue'
import TocNav from '@/components/tutorial/TocNav.vue'
import FirstRunOverlay from '@/components/tutorial/FirstRunOverlay.vue'
import BaguaSVG from '@/components/tutorial/figures/BaguaSVG.vue'
import HetuLuoshuSVG from '@/components/tutorial/figures/HetuLuoshuSVG.vue'
import GanzhiZodiacSVG from '@/components/tutorial/figures/GanzhiZodiacSVG.vue'
import WuxingSVG from '@/components/tutorial/figures/WuxingSVG.vue'
import LiujiaoDiagram from '@/components/tutorial/figures/LiujiaoDiagram.vue'
import QimenDomeSVG from '@/components/tutorial/figures/QimenDomeSVG.vue'
import ZiweiPalaceSVG from '@/components/tutorial/figures/ZiweiPalaceSVG.vue'
import TakeMomentTimeline from '@/components/tutorial/figures/TakeMomentTimeline.vue'

/** 图示 key → 组件映射（条目来自母版 figureItems，讲解文案随内容闸走） */
const FIG_COMPONENTS: Record<string, Component> = {
  bagua: BaguaSVG,
  hetuluoshu: HetuLuoshuSVG,
  wuxing: WuxingSVG,
  ganzhi: GanzhiZodiacSVG,
  liujiao: LiujiaoDiagram,
  qimen: QimenDomeSVG,
  ziwei: ZiweiPalaceSVG,
  takemoment: TakeMomentTimeline
}

/** 展开的图示卡（多开） */
const openFigs = ref<Set<string>>(new Set())
function toggleFig(id: string) {
  const next = new Set(openFigs.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  openFigs.value = next
}

/**
 * 教程页（JY-14）：底部第 4 tab 常驻
 * Hero + 场景问答入口（怎么选）+ 六功能卡片（可展开）+ 易学图示 + 操作指引 + 合规须知 + 章节锚点导航。
 */
const introTitle = introItems[0]?.title ?? '稽疑是什么'

/**
 * 章节列表：驱动 Toc 抽屉与锚点导航。
 * 必须与 <template> 中各区块包裹元素的 id 严格同名（#/tutorial#<id> 直达）。
 * 顺序即页面顺序：场景问答入口在最前（先对号入座，再看玩法与背景）。
 */
const sections = computed(() => [
  { id: 'intro', title: introTitle },
  { id: 'guide', title: '怎么选' },
  { id: 'methods', title: '六功能介绍' },
  { id: 'figures', title: '易学图示' },
  { id: 'operations', title: '操作指引' },
  { id: 'compliance', title: '合规须知' }
])

const activeId = ref('')
let observer: IntersectionObserver | null = null

function navigate(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onMounted(() => {
  // 锚点直达：#/tutorial#<id>
  const hash = decodeURIComponent(window.location.hash.split('#').pop() ?? '')
  const id = sections.value.find((s) => s.id === hash) ? hash : ''
  if (id) requestAnimationFrame(() => navigate(id))

  // IntersectionObserver 高亮当前章节
  observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) activeId.value = e.target.id
      }
    },
    { rootMargin: '-30% 0px -55% 0px' }
  )
  for (const s of sections.value) {
    const el = document.getElementById(s.id)
    if (el) observer.observe(el)
  }
})

onBeforeUnmount(() => observer?.disconnect())

/** C 方案：首启遮罩（仅未看过时弹出） */
const showOverlay = ref(loadOnboarding().tookTutorial === false)

function onOverlayFinish() {
  showOverlay.value = false
}
</script>

<template>
  <div class="page tutorial">
    <!-- Hero -->
    <header class="tutorial-hero a-fade-up">
      <div class="hero-inner" id="intro">
        <h1 class="hero-title">{{ introTitle }}</h1>
        <p v-for="p in introItems[0]?.paragraphs ?? []" :key="p" class="hero-p muted">
          {{ p }}
        </p>
      </div>
    </header>

    <!-- 章节导航抽屉 -->
    <TocNav :sections="sections" :active-id="activeId" @navigate="navigate" />

    <!-- 怎么选：场景问答式入口（先对号入座，再推荐玩法与用法） -->
    <TutorialSection id="guide" title="怎么选">
      <ScenarioPicker
        v-for="g in guideEntries"
        :key="g.id"
        :guide="g"
        :methods="methods"
      />
    </TutorialSection>

    <!-- 六功能介绍 -->
    <TutorialSection id="methods" title="六功能介绍">
      <MethodCard v-for="m in methods" :key="m.key" :method="m" />
    </TutorialSection>

    <!-- 可视化：八卦 / 洛书 / 天干地支 / 五行（讲解文案来自母版 figureItems） -->
    <TutorialSection id="figures" title="易学图示">
      <p class="fig-note">以下图示仅为传统易学的结构示意，用于辅助理解各玩法的呈现框架。点卡片可展开讲解。</p>
      <div class="fig-grid">
        <article
          v-for="f in figureItems"
          :key="f.id"
          class="fig-cell"
          :class="{ open: openFigs.has(f.id) }"
          role="button"
          tabindex="0"
          :aria-expanded="openFigs.has(f.id)"
          :aria-label="f.name"
          @click="toggleFig(f.id)"
          @keydown.enter.prevent="toggleFig(f.id)"
          @keydown.space.prevent="toggleFig(f.id)"
        >
          <component :is="FIG_COMPONENTS[f.key]" :title="f.name" />
          <span class="fig-cap">
            <span class="fig-name">{{ f.name }}</span>
            <span class="fig-caret" aria-hidden="true">{{ openFigs.has(f.id) ? '▾' : '▸' }}</span>
          </span>
          <p class="fig-brief">{{ f.brief }}</p>
          <div v-show="openFigs.has(f.id)" class="fig-detail">
            <p>{{ f.detail }}</p>
          </div>
        </article>
      </div>
    </TutorialSection>

    <!-- 操作指引 -->
    <TutorialSection id="operations" title="操作指引">
      <AccordionSection
        v-for="op in operationEntries"
        :id="op.id"
        :key="op.id"
        :title="op.title"
      >
        <ol class="ops">
          <li v-for="(s, i) in op.steps" :key="s.title" class="op">
            <span class="op-no" aria-hidden="true">{{ String(i + 1).padStart(2, '0') }}</span>
            <span class="op-body">
              <strong>{{ s.title }}</strong>
              <span>{{ s.text }}</span>
            </span>
          </li>
        </ol>
      </AccordionSection>
    </TutorialSection>

    <!-- 合规须知 -->
    <TutorialSection id="compliance" title="合规须知">
      <div v-if="compliance" class="compliance">
        <p class="disclaimer">{{ compliance.disclaimer }}</p>
        <dl>
          <dt>年龄</dt><dd>{{ compliance.age }}</dd>
          <dt>数据</dt><dd>{{ compliance.dataLocal }}</dd>
          <dt>流派</dt><dd>{{ compliance.school }}</dd>
        </dl>
        <RouterLink class="privacy-link" :to="{ name: 'privacy' }">{{ compliance.privacy }}</RouterLink>
      </div>
    </TutorialSection>

    <!-- 首启轻引导遮罩 -->
    <FirstRunOverlay v-if="showOverlay" @finish="onOverlayFinish" />
  </div>
</template>

<style scoped>
.tutorial {
  position: relative;
  z-index: 1;
}
.tutorial-hero {
  padding: 0.14rem 0.05rem 0.02rem;
}
.hero-inner {
  border-radius: var(--radius);
  border: 1px solid var(--line-soft);
  background: linear-gradient(180deg, rgba(192, 72, 60, 0.1), var(--panel));
  padding: 0.16rem 0.14rem;
  scroll-margin-top: 0.5rem;
}
.hero-title {
  font-family: var(--font-serif);
  font-size: 0.22rem;
  letter-spacing: 0.04em;
  background: linear-gradient(120deg, var(--text) 15%, var(--cinnabar-bright) 50%, var(--bronze-bright) 85%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  width: fit-content;
  margin-bottom: 0.08rem;
  padding-bottom: 0.08rem;
  position: relative;
}
/* 标题下的朱砂渐隐细线：与首页「起占」分节标线同语系 */
.hero-title::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  width: 0.5rem;
  height: 2px;
  border-radius: 1px;
  background: linear-gradient(90deg, var(--cinnabar), transparent);
}
.hero-p {
  font-size: 0.12rem;
  line-height: 1.7;
}
.hero-p + .hero-p {
  margin-top: 0.1rem;
}
/* 末段是「说明：…」口径注释：降级为小字注脚，与正文分层 */
.hero-p:last-of-type {
  margin-top: 0.12rem;
  padding-top: 0.08rem;
  border-top: 1px dashed var(--line-soft);
  font-size: 0.1rem;
  color: var(--text-3);
}
.fig-note {
  font-size: 0.11rem;
  color: var(--text-3);
  line-height: 1.6;
}
.fig-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.1rem;
}
.fig-cell {
  display: flex;
  flex-direction: column;
  gap: 0.04rem;
  padding: 0.1rem;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-s);
  background: var(--panel-2);
  cursor: pointer;
  transition: border-color var(--dur-fast) var(--ease-out),
    transform var(--dur-fast) var(--ease-out),
    box-shadow var(--dur-fast) var(--ease-out);
}
.fig-cell:hover,
.fig-cell:focus-visible {
  border-color: var(--bronze-dim);
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
  outline: none;
}
.fig-cell.open {
  border-color: var(--bronze-dim);
  background: var(--panel);
}
.fig-cap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.06rem;
  margin-top: 0.02rem;
}
.fig-name {
  font-size: 0.11rem;
  color: var(--text);
  font-family: var(--font-serif);
  letter-spacing: 0.02em;
}
.fig-caret {
  font-size: 0.1rem;
  color: var(--text-3);
}
.fig-brief {
  font-size: 0.1rem;
  color: var(--text-3);
  line-height: 1.5;
}
.fig-detail {
  margin-top: 0.02rem;
  padding-top: 0.07rem;
  border-top: 1px dashed var(--line-soft);
  animation: fig-fade var(--dur-fast) var(--ease-out);
}
.fig-detail p {
  font-size: 0.105rem;
  color: var(--text-2);
  line-height: 1.65;
}
@keyframes fig-fade {
  from {
    opacity: 0;
    transform: translateY(-0.03rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .fig-detail {
    animation: none;
  }
}
.ops {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  list-style: none;
  padding: 0;
  margin: 0;
}
.op {
  display: flex;
  gap: 0.1rem;
  font-size: 0.11rem;
  line-height: 1.6;
  color: var(--text-2);
}
.op-no {
  flex: none;
  width: 0.26rem;
  height: 0.26rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--bronze-dim);
  border-radius: 50%;
  color: var(--bronze-bright);
  font-size: 0.1rem;
  font-family: var(--font-serif);
  margin-top: 0.01rem;
}
.op-body {
  display: flex;
  flex-direction: column;
  gap: 0.02rem;
}
.op-body strong {
  color: var(--text);
  font-size: 0.115rem;
}
.compliance {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}
.disclaimer {
  font-size: 0.12rem;
  color: var(--text-2);
  line-height: 1.7;
}
.compliance dl {
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
}
.compliance dt {
  font-size: 0.1rem;
  color: var(--bronze-bright);
  letter-spacing: 0.04em;
}
.compliance dd {
  font-size: 0.11rem;
  color: var(--text-2);
  line-height: 1.6;
  margin-top: 0.02rem;
  padding-bottom: 0.08rem;
  border-bottom: 1px dashed var(--line-soft);
}
.compliance dd:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.privacy-link {
  align-self: flex-start;
  color: var(--cinnabar-bright);
  font-size: 0.12rem;
  text-decoration: underline;
}
</style>