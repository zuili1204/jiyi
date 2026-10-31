<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { ReadingRecord } from '@/types/reading'
import { useAiStore } from '@/stores/ai'
import { useRecordsStore } from '@/stores/records'
import { useToastStore } from '@/stores/toast'
import { createAiSession, type AiRunResult, type AiSession } from '@/engine/ai/client'

/**
 * AI 白话解读区块（JY-07 §6 / Y8-07）
 *
 * 纪律：
 * - 「由 AI 生成，仅供参考」**常驻**标注，不折叠、不消失（R8：AI 不是官方结论）；
 * - flagged 命中 → 显著提示词族，原文照常渲染（只标记不改写，保留可审计性）；
 * - 取消 / 离开页面 → 作废在途结果（自增 token），迟到的响应绝不渲染（JY-07 §9 验收 5）。
 */
const props = defineProps<{ record: ReadingRecord }>()

const router = useRouter()
const aiStore = useAiStore()
const store = useRecordsStore()
const toast = useToastStore()

const ai = computed(() => props.record.ai)
const running = ref(false)
const error = ref<{ title: string; detail: string } | null>(null)

let session: AiSession | undefined

function stop() {
  session?.cancel()
  session = undefined
  running.value = false
}

async function generate() {
  if (running.value) return
  if (!aiStore.ready) {
    toast.show('请先在设置中启用 AI 深度解读并填好密钥')
    return
  }
  error.value = null
  running.value = true
  try {
    // 每次生成开新会话：旧会话的在途结果随 token 自增被作废
    session = createAiSession(aiStore.config)
    const res: AiRunResult = await session.run(props.record)
    if (res.status === 'cancelled') {
      // 用户主动取消：不留错误提示，也不渲染（running 由 finally 复位）
      return
    }
    if (res.status === 'error') {
      error.value = { title: res.title, detail: res.detail }
      return
    }
    if (!store.setAi(props.record.id, res.ai)) {
      // 存储写入失败：结果本次会话仍可见，但不落库 —— 必须说清，不能装作已保存
      toast.show('解读结果未能保存（本机存储不可用），仅本次可见')
    }
    if (res.ai.flagged?.length) toast.show('AI 输出含受限表述，已标记供核验（原文保留）')
  } catch (e) {
    // 客户端内部分层兜底之外的最后一张网：异常绝不悬空
    console.warn('[jiyi] AI 解读失败：', e)
    error.value = { title: '解读未能完成', detail: '发生了意外问题，请稍后重试。' }
  } finally {
    running.value = false
  }
}

function toSettings() {
  router.push({ name: 'settings-ai' })
}

function fmtTime(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 禁词族 → 提示文案（只解释类别，不替模型遮掩原文） */
const FAMILY_LABEL: Record<string, string> = {
  absolute: '绝对化断语',
  medical: '医疗',
  invest: '投资',
  legal: '司法',
  gender: '生育性别',
  doom: '凶灾恐吓',
  religion: '宗教劝导',
  authority: '权威背书',
  fate: '宿命表述',
  yingqi: '应期断言'
}

const flaggedText = computed(() =>
  (ai.value?.flagged ?? []).map((f) => FAMILY_LABEL[f] ?? f).join('、')
)

/**
 * 仅展示层清理 Markdown 残留（星号强调、井号标题、列表符）。
 * 落库的 ai.text 原文不动，保持可审计；prompt 已要求纯文字，这里是兜底。
 */
const displayText = computed(() =>
  (ai.value?.text ?? '')
    .replace(/\*\*|__/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*[-•]\s+/gm, '')
)

onBeforeUnmount(stop)
</script>

<template>
  <section class="ai-panel">
    <header class="head">
      <h3>AI 白话解读</h3>
      <span class="badge">由 AI 生成，仅供参考</span>
    </header>
    <p class="lead">把已算出的结果讲成人话；核心判断仍以确定性引擎为准。</p>

    <!-- 已有结果：原文原样渲染，flagged 只加提示 -->
    <template v-if="ai">
      <p v-if="flaggedText" class="flagged">
        注意：本段输出含受限表述（{{ flaggedText }}），按纪律仅标记不改写，原文保留供核验。
      </p>
      <p class="text">{{ displayText }}</p>
      <p class="meta">
        {{ ai.model ?? '未知模型' }} · {{ fmtTime(ai.createdAt) }}
      </p>
      <div class="acts">
        <button type="button" class="ghost" :disabled="running" @click="generate">
          重新生成
        </button>
      </div>
    </template>

    <!-- 尚无结果：入口 / 进度 / 错误 -->
    <template v-else>
      <p v-if="error" class="err">
        <strong>{{ error.title }}</strong>
        <span>{{ error.detail }}</span>
      </p>
      <div v-if="running" class="acts">
        <span class="hint">生成中…直连你的服务商，通常数秒</span>
        <button type="button" class="ghost" @click="stop">取消</button>
      </div>
      <div v-else class="acts">
        <button type="button" class="solid" @click="generate">生成白话解读</button>
        <button v-if="!aiStore.ready" type="button" class="ghost" @click="toSettings">
          去设置
        </button>
      </div>
      <p v-if="!aiStore.ready" class="meta">
        需要先在「设置 → AI 深度解读」中启用并填入你自己的 API Key（BYOK）。
      </p>
    </template>
  </section>
</template>

<style scoped>
.ai-panel {
  margin-top: 0.12rem;
  padding: 0.14rem;
  border-radius: var(--radius);
  border: 1px solid var(--line-soft);
  background: var(--panel);
}
.head {
  display: flex;
  align-items: center;
  gap: 0.08rem;
  flex-wrap: wrap;
}
h3 {
  font-size: 0.15rem;
  margin: 0;
}
.badge {
  font-size: 0.1rem;
  color: var(--cinnabar-bright);
  border: 1px solid var(--cinnabar-dim);
  border-radius: var(--radius-pill);
  padding: 0.01rem 0.06rem;
}
.lead {
  margin: 0.05rem 0 0;
  font-size: 0.12rem;
  color: var(--text-3);
  line-height: 1.7;
}
.text {
  margin: 0.08rem 0 0;
  white-space: pre-wrap;
  line-height: 1.75;
  font-size: 0.14rem;
}
.meta {
  margin: 0.06rem 0 0;
  font-size: 0.11rem;
  color: var(--text-3);
  line-height: 1.7;
}
.flagged {
  margin: 0.08rem 0 0;
  font-size: 0.12rem;
  line-height: 1.7;
  color: var(--cinnabar-bright);
  border: 1px dashed var(--cinnabar-dim);
  border-radius: var(--radius-s);
  padding: 0.06rem 0.08rem;
}
.err {
  margin: 0.08rem 0 0;
  font-size: 0.12rem;
  line-height: 1.7;
  display: flex;
  flex-direction: column;
  gap: 0.02rem;
}
.err strong {
  color: var(--cinnabar-bright);
  font-weight: 600;
}
.err span {
  color: var(--text-2);
}
.acts {
  display: flex;
  gap: 0.08rem;
  margin-top: 0.1rem;
  align-items: center;
}
.acts button {
  flex: none;
  min-height: 0.4rem;
  padding: 0 0.14rem;
  border-radius: var(--radius-pill);
  font-size: 0.13rem;
}
.solid {
  background: var(--cinnabar);
  color: #fff;
}
.ghost {
  border: 1px solid var(--line-soft);
  color: var(--text-2);
}
.hint {
  font-size: 0.12rem;
  color: var(--text-3);
}
</style>
