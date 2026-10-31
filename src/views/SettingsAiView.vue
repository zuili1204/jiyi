<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAiStore } from '@/stores/ai'
import { useToastStore } from '@/stores/toast'
import { AI_PROVIDERS } from '@/data/ai-providers'

/**
 * AI 深度解读设置（JY-07 §3 / §8 / Y8-06）
 *
 * 纪律：
 * - **首次启用必须过知情弹窗**：请求直连第三方 / 密钥明文存本机 / 费用自负，三点缺一不可；
 * - 明文存储风险常驻明示；一键清除密钥（整包移除，不留痕）；
 * - 模型名可编辑（预设只是"当时的默认值"，JY-07 §7）；
 * - 敏感信息开关默认关：关闭时出生数据一律不进请求体（§9 验收 2）。
 */
const router = useRouter()
const ai = useAiStore()
const toast = useToastStore()

const showConsent = ref(false)
const showKey = ref(false)

function back() {
  if (typeof window !== 'undefined' && window.history.length > 1) router.back()
  else router.replace({ name: 'settings' })
}

function onToggleEnable(on: boolean) {
  if (!on) {
    ai.update({ enabled: false })
    return
  }
  if (ai.config.acknowledgedAt == null) {
    showConsent.value = true // 先知情，再启用
    return
  }
  ai.update({ enabled: true })
}

function agreeConsent() {
  showConsent.value = false
  ai.acknowledge()
  toast.show('已启用；请选择服务商并填入你的 API Key')
}

function declineConsent() {
  showConsent.value = false
}

function clearKey() {
  ai.clearKey()
  showKey.value = false
  toast.show('已清除 AI 密钥与配置')
}

function onKeyInput(e: Event) {
  ai.update({ apiKey: (e.target as HTMLInputElement).value.trim() })
}
</script>

<template>
  <div class="page settings-ai">
    <header class="bar">
      <button type="button" class="back" @click="back">‹ 返回</button>
    </header>

    <h2 class="section-title">AI 深度解读</h2>
    <p class="lead">
      把已算出的结果转述成白话，不作额外解读；核心判断仍由确定性引擎完成。
      请求由你的设备<strong>直连你所选的服务商</strong>，不经任何我方服务器（本应用没有服务端）。
    </p>

    <!-- 知情弹窗：首次启用前必看（JY-07 §3） -->
    <section v-if="showConsent" class="card consent" role="dialog" aria-label="AI 功能知情确认">
      <h3>启用前请知情</h3>
      <ul>
        <li>请求由你的设备直连第三方服务商，内容受该服务商条款约束</li>
        <li>API Key 以<strong>明文</strong>保存在本机，请勿在他人设备上填写</li>
        <li>模型调用产生的费用由你的账户承担</li>
        <li>关闭「允许发送敏感信息」时，出生数据不会进入请求</li>
      </ul>
      <div class="acts">
        <button type="button" class="ghost" @click="declineConsent">暂不</button>
        <button type="button" class="solid" @click="agreeConsent">已知晓，启用</button>
      </div>
    </section>

    <div class="card">
      <label class="item">
        <span>启用 AI 深度解读<small>BYOK：使用你自己的 API Key，密钥不参与导出备份</small></span>
        <input
          type="checkbox"
          :checked="ai.config.enabled"
          @change="onToggleEnable(($event.target as HTMLInputElement).checked)"
        />
      </label>
      <p class="note">开启后在此页配置服务商、模型与密钥；配置仅保存在本机，关闭开关不会清除已填内容。</p>
    </div>

    <template v-if="ai.config.acknowledgedAt != null">
      <h2 class="section-title">服务商</h2>
      <div class="card">
        <label class="item col">
          <span>服务商</span>
          <select
            :value="ai.config.provider"
            @change="ai.setProvider(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="p in AI_PROVIDERS" :key="p.id" :value="p.id">{{ p.label }}</option>
          </select>
        </label>
        <label class="item col">
          <span>Base URL<small>OpenAI 兼容端点，可自行修改</small></span>
          <input
            type="text"
            :value="ai.config.baseUrl"
            placeholder="https://…"
            @change="ai.update({ baseUrl: ($event.target as HTMLInputElement).value.trim() })"
          />
        </label>
        <label class="item col">
          <span>模型名<small>由你按服务商文档自由填写，不预设 chat / flash / pro 等档位</small></span>
          <input
            type="text"
            :value="ai.config.model"
            placeholder="填入服务商提供的模型名"
            @change="ai.update({ model: ($event.target as HTMLInputElement).value.trim() })"
          />
        </label>
        <label class="item">
          <span>温度<small>0~2，越高越发散；白话转述建议 0.7 以下</small></span>
          <input
            type="number"
            min="0"
            max="2"
            step="0.1"
            :value="ai.config.temperature"
            @change="ai.update({ temperature: Number(($event.target as HTMLInputElement).value) || 0 })"
          />
        </label>
      </div>

      <h2 class="section-title">密钥</h2>
      <div class="card">
        <label class="item col">
          <span>API Key</span>
          <input
            :type="showKey ? 'text' : 'password'"
            :value="ai.config.apiKey"
            placeholder="sk-…"
            autocomplete="off"
            @change="onKeyInput"
          />
        </label>
        <div class="acts">
          <button type="button" class="ghost" @click="showKey = !showKey">
            {{ showKey ? '隐藏' : '显示' }}
          </button>
          <button type="button" class="ghost" @click="clearKey">一键清除密钥</button>
        </div>
        <p class="note risk">
          风险明示：密钥以明文保存在本机（独立存储，不参与导出备份）。本应用不会上传密钥，
          但请勿在不可信设备上填写；清除应用数据或卸载即一并删除。
        </p>
      </div>

      <h2 class="section-title">隐私</h2>
      <div class="card">
        <label class="item">
          <span>
            允许发送敏感信息<small>关闭时出生数据一律不进入 AI 请求（当前版本品类不含出生数据，为八字 / 紫微预留）</small>
          </span>
          <input
            type="checkbox"
            :checked="ai.config.allowSensitive"
            @change="ai.update({ allowSensitive: ($event.target as HTMLInputElement).checked })"
          />
        </label>
        <p class="note">
          AI 输出经内容闸同源词表后检：命中受限表述只标记不改写，原文保留供核验。
          详见
          <a href="#/privacy" class="link">隐私政策</a>「AI 功能说明（BYOK）」。
        </p>
      </div>
    </template>
  </div>
</template>

<style scoped>
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
.lead {
  font-size: 0.12rem;
  color: var(--text-2);
  line-height: 1.7;
  margin: 0 0 0.08rem;
}
.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.1rem;
  min-height: 0.48rem;
  padding: 0.06rem 0;
  font-size: 0.14rem;
  width: 100%;
  text-align: left;
  border-bottom: 1px solid var(--line-soft);
}
.item:last-child {
  border-bottom: none;
}
.item small {
  display: block;
  font-size: 0.11rem;
  color: var(--text-3);
  line-height: 1.5;
}
.item.col {
  flex-direction: column;
  align-items: stretch;
  gap: 0.04rem;
}
.item input,
.item select {
  min-height: 0.36rem;
  font-size: 0.13rem;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-s);
  background: var(--bg-2);
  color: var(--text);
  padding: 0 0.08rem;
}
.item input[type='checkbox'] {
  appearance: none;
  width: 0.44rem;
  height: 0.26rem;
  flex: none;
  min-height: 0;
  border: none;
  border-radius: var(--radius-pill);
  background: var(--line-soft);
  position: relative;
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease-out);
}
.item input[type='checkbox']::after {
  content: '';
  position: absolute;
  top: 0.03rem;
  left: 0.03rem;
  width: 0.2rem;
  height: 0.2rem;
  border-radius: 50%;
  background: var(--text-2);
  transition: transform var(--dur-fast) var(--ease-out);
}
.item input[type='checkbox']:checked {
  background: var(--cinnabar);
}
.item input[type='checkbox']:checked::after {
  transform: translateX(0.18rem);
  background: #fff;
}
.item input[type='number'] {
  width: 0.8rem;
  flex: none;
}
.acts {
  display: flex;
  gap: 0.08rem;
  margin-top: 0.08rem;
}
.acts button {
  min-height: 0.4rem;
  padding: 0 0.14rem;
  border-radius: var(--radius-pill);
  font-size: 0.13rem;
}
.ghost {
  border: 1px solid var(--line-soft);
  color: var(--text-2);
}
.solid {
  background: var(--cinnabar);
  color: #fff;
}
.note {
  font-size: 0.12rem;
  color: var(--text-2);
  line-height: 1.7;
  margin-top: 0.06rem;
}
.note.risk {
  color: var(--cinnabar-bright);
}
.link {
  color: var(--cinnabar-bright);
  text-decoration: underline;
}
/* 知情弹窗：与 BirthDataConsent 同风格的内联卡片 */
.consent h3 {
  font-size: 0.15rem;
  margin-bottom: 0.06rem;
}
.consent ul {
  margin: 0.08rem 0 0;
  padding-left: 0.18rem;
  font-size: 0.12rem;
  line-height: 1.8;
  color: var(--text-2);
}
.consent .acts {
  margin-top: 0.12rem;
}
.consent .acts button {
  flex: 1;
}
</style>
