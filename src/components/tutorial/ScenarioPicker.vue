<script setup lang="ts">
import { computed, ref } from 'vue'
import type { GuideEntry, GuideItem, TutorialMethod, TutorialMethodKey } from '@/data/content/tutorial'
import CategoryIcon from '@/components/CategoryIcon.vue'
import { methodAccent } from '@/types/reading'

/**
 * 「怎么选」场景问答式入口（JY-14 §4.1，J28 弱推荐口径）
 *
 * 先选「此刻想问的事」（场景卡网格），再展开传统上常对应的玩法推荐：
 * 点选场景 → 高亮该卡 → 下方出现推荐面板（玩法胶囊 + 逐玩法用法速览 + 去首页入口）。
 * 只表述「传统上常用于」，绝不构成断言（J28 弱推荐）。
 */
const props = defineProps<{
  guide: GuideEntry
  methods: TutorialMethod[]
}>()

/** 存选中的场景名（按 scenario 字符串比较，避免对象引用比较在模板代理下的身份漂移） */
const selectedName = ref<string | null>(null)

const methodByName = new Map(props.methods.map((m) => [m.key, m]))

function methodOf(key: TutorialMethodKey): TutorialMethod | undefined {
  return methodByName.get(key)
}

function select(name: string) {
  selectedName.value = selectedName.value === name ? null : name
}

const selectedItem = computed<GuideItem | undefined>(() =>
  props.guide.items.find((it) => it.scenario === selectedName.value)
)
</script>

<template>
  <div class="picker">
    <p class="picker-intro">{{ guide.intro }}</p>

    <!-- 场景卡网格：每卡「场景名 + 一句话说明」，先对号入座再点选 -->
    <div class="scenarios">
      <button
        v-for="item in guide.items"
        :key="item.scenario"
        type="button"
        class="scenario"
        :class="{ on: selectedName === item.scenario }"
        :aria-pressed="selectedName === item.scenario"
        @click="select(item.scenario)"
      >
        <span class="sc-name">{{ item.scenario }}</span>
        <span v-if="item.say" class="sc-say">{{ item.say }}</span>
      </button>
    </div>

    <!-- 推荐面板：玩法胶囊 + 逐玩法用法速览 + 去首页 -->
    <div v-if="selectedItem" class="result">
      <p class="result-label">传统上常用于</p>
      <div class="recs">
        <span
          v-for="key in selectedItem.recommend"
          :key="key"
          class="rec"
          :class="{ partial: methodOf(key)?.status === 'partial' }"
          :style="{ '--accent': methodAccent(key) }"
        >
          <CategoryIcon :kind="key" :size="18" />
          <span class="rec-name">{{ methodOf(key)?.name ?? key }}</span>
          <em v-if="methodOf(key)?.status === 'partial'" class="rec-recent">待完善</em>
        </span>
      </div>

      <!-- 逐玩法「怎么用」速览：输入口径 + 一句话门槛描述 -->
      <ol class="howtos">
        <li
          v-for="key in selectedItem.recommend"
          :key="key"
          class="howto"
          :style="{ '--accent': methodAccent(key) }"
        >
          <span class="howto-name">{{ methodOf(key)?.name ?? key }}</span>
          <span class="howto-body">
            <span class="howto-input">用法：{{ methodOf(key)?.input ?? '见玩法速查' }}</span>
            <span class="howto-desc">{{ methodOf(key)?.desc }}</span>
          </span>
        </li>
      </ol>

      <p v-if="selectedItem.note" class="picker-note">{{ selectedItem.note }}</p>
      <p class="picker-foot">{{ guide.note }}</p>
      <RouterLink class="cta" :to="{ name: 'home' }">去首页起一卦 →</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
}
.picker-intro {
  font-size: 0.11rem;
  color: var(--text-2);
  line-height: 1.6;
}

/* 场景卡网格：两列卡片，名称 + 一句话说明，选中态朱砂描边 */
.scenarios {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.08rem;
}
.scenario {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.03rem;
  padding: 0.1rem 0.12rem;
  border-radius: var(--radius);
  border: 1px solid var(--line-soft);
  background: var(--panel);
  text-align: left;
  cursor: pointer;
  transition: border-color var(--dur-fast) var(--ease-out),
    background var(--dur-fast) var(--ease-out),
    transform var(--dur-fast) var(--ease-out);
}
.scenario:hover,
.scenario:focus-visible {
  border-color: var(--bronze-dim);
  transform: translateY(-1px);
  outline: none;
}
.scenario.on {
  background: linear-gradient(180deg, rgba(192, 72, 60, 0.14), var(--panel));
  border-color: var(--cinnabar-dim);
}
.sc-name {
  font-family: var(--font-serif);
  font-size: 0.13rem;
  color: var(--text);
}
.scenario.on .sc-name {
  color: var(--cinnabar-bright);
}
.sc-say {
  font-size: 0.1rem;
  color: var(--text-3);
  line-height: 1.4;
}

/* 推荐面板 */
.result {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.12rem;
  border-radius: var(--radius);
  border: 1px solid var(--line-soft);
  background: var(--panel-2);
  animation: res-fade var(--dur-base) var(--ease-out);
}
@keyframes res-fade {
  from {
    opacity: 0;
    transform: translateY(-0.04rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .result {
    animation: none;
  }
}
.result-label {
  font-size: 0.11rem;
  color: var(--text-3);
}
.recs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.07rem;
}
.rec {
  display: inline-flex;
  align-items: center;
  gap: 0.05rem;
  padding: 0.03rem 0.08rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--accent, var(--cinnabar-dim));
  color: var(--accent, var(--cinnabar-bright));
  font-size: 0.11rem;
}
.rec.partial {
  border-style: dashed;
}
.rec-recent {
  font-style: normal;
  font-size: 0.09rem;
  color: var(--bronze);
}

/* 逐玩法用法速览 */
.howtos {
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
  list-style: none;
  padding: 0;
  margin: 0;
}
.howto {
  display: flex;
  gap: 0.1rem;
  padding: 0.08rem 0.1rem;
  border-radius: var(--radius-s);
  background: var(--panel);
  border-left: 0.03rem solid var(--accent, var(--line-soft));
}
.howto-name {
  flex: none;
  font-family: var(--font-serif);
  font-size: 0.12rem;
  color: var(--accent, var(--text));
}
.howto-body {
  display: flex;
  flex-direction: column;
  gap: 0.02rem;
  font-size: 0.105rem;
  line-height: 1.55;
  color: var(--text-2);
}
.howto-input {
  color: var(--text);
}
.picker-note,
.picker-foot {
  font-size: 0.1rem;
  color: var(--text-3);
  line-height: 1.6;
}

/* 去首页入口 */
.cta {
  align-self: flex-start;
  min-height: 0.34rem;
  display: inline-flex;
  align-items: center;
  padding: 0 0.14rem;
  border-radius: var(--radius-pill);
  background: var(--cinnabar);
  color: #fff;
  font-size: 0.12rem;
  text-decoration: none;
}
</style>
