<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ReadingResult from '@/components/ReadingResult.vue'
import AiPanel from '@/components/AiPanel.vue'
import { useRecordsStore } from '@/stores/records'
import { useToastStore } from '@/stores/toast'
import { methodLabel, methodAccent } from '@/types/reading'

/**
 * 记录详情（结果独立成页）
 *
 * 为什么独立成页：签文解曰可达 1600 字、卦象结果含本卦 / 之卦与排盘依据，
 * 直接堆在首页起卦区下方会把品类入口与表单顶出屏幕 —— "求完一卦就找不到入口了"。
 * 现在首页只负责起卦，结果一律进本页；**首页与历史页共用同一条入口**。
 *
 * 纪律：
 * - 记录不存在 / id 非法 → 显示空态与返回，**不猜、不造一条假记录**（YR2 同源）；
 * - 深链直达（无上一页历史）时回首页，而不是把用户直接弹出应用；
 * - 分享图仍只由 `ReadingResult` 生成，本页不额外拼装任何用户输入（YR19）。
 */
const route = useRoute()
const router = useRouter()
const store = useRecordsStore()
const toast = useToastStore()

const id = computed(() => String(route.params.id ?? ''))
const record = computed(() => store.byId(id.value))

/** 所问（签占为 note，卜筮为 question）：空就不显示，不写占位文案 */
const question = computed(() => {
  const input = record.value?.input ?? {}
  const v = typeof input['question'] === 'string' ? input['question'] : ''
  const n = typeof input['note'] === 'string' ? input['note'] : ''
  return (v || n).trim()
})

function fmtTime(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function back() {
  // 有上一页（从首页 / 历史页进来）就回去；深链直达没有上一页，回首页而不是退出应用
  if (typeof window !== 'undefined' && window.history.length > 1) router.back()
  else router.replace({ name: 'home' })
}

function onDelete() {
  const r = record.value
  if (!r) return
  store.remove(r.id)
  toast.show('已删除该记录')
  // 已删除的详情页没有停留价值：回历史页（不是 back，否则会退回一个空壳详情）
  router.replace({ name: 'history' })
}
</script>

<template>
  <div class="page detail">
    <header class="bar">
      <button type="button" class="back" @click="back">‹ 返回</button>
    </header>

    <template v-if="record">
      <p class="meta" :style="{ '--accent': methodAccent(record.method) }">
        <span class="dot" aria-hidden="true"></span>
        <span class="method">{{ methodLabel(record.method) }}</span>
        <span> · {{ fmtTime(record.createdAt) }}</span>
        <span v-if="record.ai" class="ai-badge">已 AI 解读</span>
      </p>
      <p v-if="question" class="ask">所问：{{ question }}</p>

      <ReadingResult
        :interpretation="record.interpretation"
        :shareable="record.method !== 'coin'"
      />

      <!-- AI 白话解读（JY-07）：只转述引擎结果，常驻 AI 标注 -->
      <AiPanel :record="record" />

      <button type="button" class="del" @click="onDelete">删除这条记录</button>
    </template>

    <div v-else class="missing">
      <p class="muted">记录不存在或已删除。</p>
      <button type="button" class="back" @click="back">返回</button>
    </div>
  </div>
</template>

<style scoped>
.detail {
  position: relative;
  z-index: 1;
}
.bar {
  display: flex;
  margin-bottom: 0.06rem;
}
.back {
  min-height: 0.44rem;
  padding: 0 0.12rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--line-soft);
  color: var(--text-2);
  font-size: 0.13rem;
}
.meta {
  display: flex;
  align-items: center;
  font-size: 0.12rem;
  color: var(--text-3);
}
/* 品类识别色：与列表条目同一含义（METHOD_ACCENT，只引 token） */
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
.ai-badge {
  margin-left: 0.06rem;
  font-size: 0.09rem;
  line-height: 1;
  padding: 0.02rem 0.06rem;
  border-radius: var(--radius-pill);
  color: var(--bronze-bright);
  border: 1px solid var(--bronze-dim);
}
.ask {
  margin-top: 0.04rem;
  font-size: 0.13rem;
  color: var(--text-2);
  line-height: 1.7;
  word-break: break-word;
}
.del {
  margin-top: 0.12rem;
  width: 100%;
  min-height: 0.44rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--cinnabar-dim);
  color: var(--cinnabar-bright);
  font-size: 0.13rem;
}
.missing {
  padding: 0.24rem 0;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.12rem;
}
</style>
