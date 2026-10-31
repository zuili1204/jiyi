<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useRecordsStore } from '@/stores/records'
import { useToastStore } from '@/stores/toast'
import { methodLabel, methodAccent } from '@/types/reading'
import type { ReadingRecord } from '@/types/reading'
import type { ImportMode } from '@/platform/exportImport'

/**
 * 历史与筛选（Y2-06）
 *
 * 筛选口径：`method`（子玩法）而非 `kind` —— 「掷硬币」内部验证引擎复用 `kind='lots'`，
 * 按 kind 筛会把内部记录混进灵签，统计与分享都会失真。
 *
 * 查找：关键词搜标题 / 摘要 / 所问 / 玩法名；列表默认**新的在前**、按批加载
 * （记录一多一次全渲会卡，也是"找不到上一条"的根源）。
 * 整行可点 → 跳 `/record/:id` 详情页（与首页「最近」共用同一条入口）；
 * 删除按钮 `@click.stop`，避免"想删除却进了详情"。
 */
const store = useRecordsStore()
const toast = useToastStore()
const router = useRouter()

/** 六个品类都要能被筛到：漏掉哪个，那个品类的记录就只能靠「全部」里翻 */
const FILTERS = [
  { key: 'all', label: '全部', match: () => true },
  { key: 'sign', label: '灵签', match: (m: string) => m === 'sign' },
  { key: 'iching', label: '卜筮', match: (m: string) => m === 'liujiao' || m === 'meihua' },
  { key: 'bazi', label: '八字', match: (m: string) => m === 'sizhu' },
  { key: 'ziwei', label: '紫微', match: (m: string) => m === 'minggong' },
  { key: 'qimen', label: '奇门', match: (m: string) => m === 'chaibu' },
  { key: 'coin', label: '内部', match: (m: string) => m === 'coin' }
] as const

const filter = ref<(typeof FILTERS)[number]['key']>('all')
const active = computed(() => FILTERS.find((f) => f.key === filter.value) ?? FILTERS[0])

/** 关键词搜索：命中标题 / 摘要 / 所问 / 玩法名任一即可（不搜出生数据，那是敏感信息） */
const query = ref('')
const PAGE_SIZE = 20
const shown = ref(PAGE_SIZE)

/** 可搜索文本：只拼展示层已有的字段，不碰出生数据 */
function searchableText(r: ReadingRecord): string {
  const input = r.input ?? {}
  const q = [input['question'], input['note'], input['text']]
    .filter((v) => typeof v === 'string')
    .join(' ')
  return [r.interpretation.title, r.interpretation.summary, q, methodLabel(r.method)]
    .filter(Boolean)
    .join(' ')
}

const list = computed(() => {
  const kw = query.value.trim().toLowerCase()
  return store.records
    .filter((r) => active.value.match(r.method))
    .filter((r) => (kw ? searchableText(r).toLowerCase().includes(kw) : true))
    .slice()
    .reverse()
})

const pagedList = computed(() => list.value.slice(0, shown.value))
const remaining = computed(() => list.value.length - pagedList.value.length)

/** 换筛选或换关键词：从头看，别停在上一轮的加载进度上 */
watch([filter, query], () => {
  shown.value = PAGE_SIZE
})

/** 计数直接由 FILTERS 推导：加了筛选项却忘了加计数，是这类页面最常见的一处走样 */
const counts = computed(() => {
  const c: Record<string, number> = {}
  for (const f of FILTERS) c[f.key] = store.records.filter((r) => f.match(r.method)).length
  return c
})

/** 清空不可撤销，所以做两步确认（3 秒内没跟上就自动收回） */
const confirmingClear = ref(false)
let clearTimer: ReturnType<typeof setTimeout> | undefined

function onClear() {
  if (!confirmingClear.value) {
    confirmingClear.value = true
    clearTimer = setTimeout(() => (confirmingClear.value = false), 3000)
    return
  }
  clearTimeout(clearTimer)
  confirmingClear.value = false
  store.clear()
  toast.show('已清空全部记录')
}

/** 打开记录详情（与首页「最近」共用同一条入口） */
function open(id: string) {
  router.push({ name: 'record', params: { id } })
}

const importText = ref('')
const importMode = ref<ImportMode>('keepBoth')

function onImport() {
  if (!importText.value.trim()) {
    toast.show('请先粘贴备份内容')
    return
  }
  try {
    const r = store.importJson(importText.value, importMode.value)
    toast.show(`导入完成：新增 ${r.imported} / 跳过 ${r.skipped} / 失败 ${r.failed}`)
    importText.value = ''
  } catch (e) {
    toast.show(`导入失败：${(e as Error).message}`)
  }
}

function onExport() {
  const blob = new Blob([store.exportJson()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `jiyi-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
  toast.show('已导出（默认剔除敏感字段）')
}

function fmtTime(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
</script>

<template>
  <div class="page history">
    <h2 class="section-title">记录</h2>
    <p class="muted">
      共 {{ store.count }} 条<template v-if="filter !== 'all' || query.trim()"> · 符合 {{ list.length }} 条</template>
    </p>

    <input
      v-model="query"
      type="search"
      class="search"
      placeholder="搜索：标题、所问或玩法名"
      aria-label="搜索记录"
    />

    <div class="filters" role="tablist">
      <button
        v-for="f in FILTERS"
        :key="f.key"
        role="tab"
        :aria-selected="filter === f.key"
        class="chip"
        :class="{ on: filter === f.key }"
        @click="filter = f.key"
      >
        {{ f.label }} {{ counts[f.key] }}
      </button>
    </div>

    <div v-if="pagedList.length" class="list">
      <article
        v-for="r in pagedList"
        :key="r.id"
        class="rec"
        role="button"
        tabindex="0"
        :aria-label="`查看 ${r.interpretation.title}`"
        :style="{ '--accent': methodAccent(r.method) }"
        @click="open(r.id)"
        @keydown.enter.prevent="open(r.id)"
        @keydown.space.prevent="open(r.id)"
      >
        <div class="rec-head">
          <h3 class="rec-title">{{ r.interpretation.title }}</h3>
          <span v-if="r.ai" class="ai-badge">AI 解读</span>
          <button
            type="button"
            class="del"
            :aria-label="`删除 ${r.interpretation.title}`"
            @click.stop="store.remove(r.id)"
          >
            删除
          </button>
        </div>
        <p class="muted rec-meta">
          <span class="dot" aria-hidden="true"></span>
          <span class="method">{{ methodLabel(r.method) }}</span>
          <span> · {{ fmtTime(r.createdAt) }}</span>
        </p>
        <p class="rec-summary">{{ r.interpretation.summary }}</p>
      </article>

      <button v-if="remaining > 0" type="button" class="more" @click="shown += PAGE_SIZE">
        加载更多（还有 {{ remaining }} 条）
      </button>
    </div>
    <p v-else class="muted empty">
      {{ store.count ? (query.trim() ? '没有匹配的记录，换个关键词试试' : '当前筛选下暂无记录') : '暂无记录' }}
    </p>

    <div class="acts">
      <button type="button" class="btn ghost" @click="onExport">导出备份</button>
      <button
        type="button"
        class="btn danger"
        :class="{ confirming: confirmingClear }"
        @click="onClear"
      >
        {{ confirmingClear ? '再点一次确认清空' : '清空全部' }}
      </button>
    </div>

    <h2 class="section-title">导入备份</h2>
    <div class="card">
      <textarea
        v-model="importText"
        class="ta"
        rows="4"
        placeholder="粘贴 jiyi 导出的 JSON"
      />
      <div class="modes">
        <label><input v-model="importMode" type="radio" value="keepBoth" /> 并存</label>
        <label><input v-model="importMode" type="radio" value="skip" /> 跳过重复</label>
        <label><input v-model="importMode" type="radio" value="overwrite" /> 覆盖</label>
      </div>
      <button type="button" class="btn solid" @click="onImport">导入</button>
    </div>
  </div>
</template>

<style scoped>
.search {
  width: 100%;
  min-height: 0.4rem;
  margin: 0.08rem 0;
  padding: 0 0.14rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--line-soft);
  background: var(--bg-2);
  color: var(--text);
  font-size: 0.13rem;
}
.search:focus-visible {
  outline: none;
  border-color: var(--bronze-dim);
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.06rem;
  margin: 0.1rem 0;
}
/* 七个品类筛选：按内容宽度排布并自动换行，硬塞一行会挤成看不清的窄条 */
.chip {
  flex: none;
  min-height: 0.36rem;
  padding: 0 0.12rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--line-soft);
  background: transparent;
  color: var(--text-2);
  font-size: 0.12rem;
}
.chip.on {
  background: var(--cinnabar);
  border-color: transparent;
  color: #fff;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
}
.rec {
  padding: 0.12rem;
  border-radius: var(--radius);
  background: var(--panel);
  border: 1px solid var(--line-soft);
  /* 品类色条：一屏扫过去靠颜色分玩法（颜色来自 METHOD_ACCENT，只引 token） */
  border-left: 0.04rem solid var(--accent, var(--line-soft));
  cursor: pointer;
}
.rec-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.08rem;
}
.rec-title {
  flex: 1;
  font-size: 0.15rem;
  line-height: 1.5;
}
.ai-badge {
  flex: none;
  align-self: center;
  font-size: 0.09rem;
  line-height: 1;
  padding: 0.03rem 0.07rem;
  border-radius: var(--radius-pill);
  color: var(--bronze-bright);
  border: 1px solid var(--bronze-dim);
}
.del {
  flex: none;
  font-size: 0.11rem;
  color: var(--text-3);
  padding: 0.02rem 0.06rem;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-pill);
}
.rec-meta {
  display: flex;
  align-items: center;
  margin-top: 0.04rem;
}
/* 品类色点 + 同色玩法名：与左侧色条同一含义，双重视觉锚点 */
.dot {
  flex: none;
  width: 0.08rem;
  height: 0.08rem;
  margin-right: 0.05rem;
  border-radius: 50%;
  background: var(--accent, var(--text-3));
}
.method {
  color: var(--accent, var(--text-2));
}
.rec-summary {
  margin-top: 0.04rem;
  font-size: 0.12rem;
  color: var(--text-2);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.more {
  width: 100%;
  min-height: 0.4rem;
  margin-top: 0.02rem;
  border-radius: var(--radius-pill);
  border: 1px dashed var(--line-soft);
  color: var(--text-2);
  font-size: 0.12rem;
}
.more:hover {
  border-color: var(--bronze-dim);
  color: var(--text);
}
.empty {
  padding: 0.16rem 0;
  text-align: center;
}

.acts {
  display: flex;
  gap: 0.08rem;
  margin-top: 0.14rem;
}
.btn {
  flex: 1;
  min-height: 0.44rem;
  border-radius: var(--radius-pill);
  font-size: 0.13rem;
}
.btn.ghost {
  border: 1px solid var(--line-soft);
  color: var(--text-2);
}
.btn.danger {
  border: 1px solid var(--cinnabar-dim);
  color: var(--cinnabar-bright);
}
/* 二次确认态：由描边转为实心朱砂，视觉上"变重"，避免手快连点 */
.btn.danger.confirming {
  background: var(--cinnabar);
  border-color: transparent;
  color: #fff;
}
.btn.solid {
  margin-top: 0.1rem;
  width: 100%;
  background: var(--cinnabar);
  color: #fff;
}

.ta {
  width: 100%;
  padding: 0.1rem;
  border-radius: var(--radius-s);
  border: 1px solid var(--line-soft);
  background: var(--bg-2);
  color: var(--text);
  font-size: 0.13rem;
  font-family: monospace;
  resize: vertical;
}
.modes {
  display: flex;
  gap: 0.12rem;
  margin: 0.08rem 0;
  font-size: 0.12rem;
  color: var(--text-2);
}
</style>
