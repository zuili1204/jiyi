<script setup lang="ts">
/**
 * InputSchema 驱动的表单渲染器（JY-03 §8）
 *
 * 纪律：views 不写业务规则 —— 本组件只按 InputField 描述渲染，不含任何品类逻辑。
 * 可点区域 ≥ 44 dp（JY-00 §8）。
 *
 * 交互约定：
 * - 错误**不在用户还没动手时就红一片**：字段失焦过、或点过提交，才显示该字段的错误；
 * - 提交按钮**不做 disabled**：禁用而不给理由是个死胡同，点了没反应最让人困惑；
 *   改成点击后暴露全部错误并聚焦第一个出错字段（`aria-invalid` 同步）；
 * - `gender` 用分段选择而不是下拉：只有两项时少一次展开，拇指也不用精准命中。
 */
import { computed, nextTick, ref } from 'vue'
import { optionsOf, validateInput, type InputField, type InputSchema } from '@/types/input'
import PlacePicker from './PlacePicker.vue'

const props = defineProps<{
  schema: InputSchema
  modelValue: Record<string, unknown>
  piiConsent?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: Record<string, unknown>): void
  (e: 'submit', v: Record<string, unknown>): void
}>()

const errors = computed(() => validateInput(props.schema, props.modelValue))

/** 已触碰过的字段（失焦即算），用于决定错误何时可见 */
const touched = ref<Set<string>>(new Set())
const submitted = ref(false)

function errorOf(f: InputField): string | undefined {
  if (!submitted.value && !touched.value.has(f.key)) return undefined
  return errors.value[f.key]
}

function markTouched(key: string) {
  if (!touched.value.has(key)) touched.value = new Set(touched.value).add(key)
}

function update(field: InputField, value: unknown) {
  emit('update:modelValue', { ...props.modelValue, [field.key]: value })
}

async function onSubmit() {
  submitted.value = true
  const first = props.schema.fields.find((f) => errors.value[f.key])
  if (first) {
    // 把用户带到第一个出错的地方，而不是停在原地干等
    await nextTick()
    document.getElementById(`f-${first.key}`)?.focus()
    return
  }
  emit('submit', props.modelValue)
}

const hasPii = computed(() => props.schema.fields.some((f) => f.pii))
const fieldId = (f: InputField) => `f-${f.key}`
</script>

<template>
  <form class="schema-form" novalidate @submit.prevent="onSubmit">
    <div v-for="f in schema.fields" :key="f.key" class="field">
      <label class="label" :for="fieldId(f)">
        {{ f.label }}
        <span v-if="f.required" class="req" aria-label="必填">*</span>
        <span v-if="f.pii" class="pii" title="敏感信息，导出默认剔除">敏感</span>
      </label>

      <input
        v-if="f.type === 'text'"
        :id="fieldId(f)"
        class="input"
        type="text"
        :placeholder="f.placeholder"
        :aria-invalid="!!errorOf(f)"
        :value="(modelValue[f.key] as string) ?? ''"
        @input="update(f, ($event.target as HTMLInputElement).value)"
        @blur="markTouched(f.key)"
      />

      <input
        v-else-if="f.type === 'number'"
        :id="fieldId(f)"
        class="input"
        type="number"
        inputmode="numeric"
        :min="f.min"
        :max="f.max"
        :placeholder="f.placeholder"
        :aria-invalid="!!errorOf(f)"
        :value="(modelValue[f.key] as number | string) ?? ''"
        @input="update(f, ($event.target as HTMLInputElement).value)"
        @blur="markTouched(f.key)"
      />

      <input
        v-else-if="f.type === 'date'"
        :id="fieldId(f)"
        class="input"
        type="date"
        :aria-invalid="!!errorOf(f)"
        :value="(modelValue[f.key] as string) ?? ''"
        @input="update(f, ($event.target as HTMLInputElement).value)"
        @blur="markTouched(f.key)"
      />

      <input
        v-else-if="f.type === 'time'"
        :id="fieldId(f)"
        class="input"
        type="time"
        :aria-invalid="!!errorOf(f)"
        :value="(modelValue[f.key] as string) ?? ''"
        @input="update(f, ($event.target as HTMLInputElement).value)"
        @blur="markTouched(f.key)"
      />

      <input
        v-else-if="f.type === 'datetime'"
        :id="fieldId(f)"
        class="input"
        type="datetime-local"
        :aria-invalid="!!errorOf(f)"
        :value="(modelValue[f.key] as string) ?? ''"
        @input="update(f, ($event.target as HTMLInputElement).value)"
        @blur="markTouched(f.key)"
      />

      <!-- 性别：分段选择（男 / 女），缺 options 时由 optionsOf 兜底 -->
      <div
        v-else-if="f.type === 'gender'"
        :id="fieldId(f)"
        class="seg"
        role="radiogroup"
        :aria-label="f.label"
      >
        <button
          v-for="o in optionsOf(f)"
          :key="o.value"
          type="button"
          class="seg-btn"
          role="radio"
          :class="{ on: modelValue[f.key] === o.value }"
          :aria-checked="modelValue[f.key] === o.value"
          @click="update(f, modelValue[f.key] === o.value ? '' : o.value); markTouched(f.key)"
        >
          {{ o.label }}
        </button>
      </div>

      <select
        v-else-if="f.type === 'select'"
        :id="fieldId(f)"
        class="input"
        :aria-invalid="!!errorOf(f)"
        :value="(modelValue[f.key] as string) ?? ''"
        @change="update(f, ($event.target as HTMLSelectElement).value)"
        @blur="markTouched(f.key)"
      >
        <option value="">请选择</option>
        <option v-for="o in optionsOf(f)" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>

      <!-- 出生地：城市联想 + 手填经度（此前根本没有渲染分支，字段只显示一行说明） -->
      <PlacePicker
        v-else-if="f.type === 'place'"
        :id="fieldId(f)"
        :model-value="(modelValue[f.key] as string) ?? ''"
        :placeholder="f.placeholder"
        @update:model-value="update(f, $event); markTouched(f.key)"
      />

      <div v-else-if="f.type === 'toggle'" class="toggle">
        <input
          :id="fieldId(f)"
          type="checkbox"
          :checked="Boolean(modelValue[f.key])"
          @change="update(f, ($event.target as HTMLInputElement).checked)"
        />
        <span>{{ f.help ?? f.label }}</span>
      </div>

      <p v-if="f.help && f.type !== 'toggle'" class="help">{{ f.help }}</p>
      <p v-if="errorOf(f)" class="err" role="alert">{{ errorOf(f) }}</p>
    </div>

    <p v-if="hasPii && !piiConsent" class="pii-warn">
      本项涉及出生信息：未取得同意前不会保存，也不会上传。
    </p>

    <button class="submit" type="submit">确定</button>
  </form>
</template>

<style scoped>
.schema-form {
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.04rem;
}
.label {
  font-size: 0.12rem;
  color: var(--text-2);
}
.req {
  color: var(--cinnabar);
}
.pii {
  margin-left: 0.05rem;
  font-size: 0.1rem;
  padding: 0 0.05rem;
  border: 1px solid currentColor;
  border-radius: var(--radius-pill);
  opacity: 0.6;
}
.input {
  min-height: 0.44rem; /* 可点区域 ≥ 44dp */
  padding: 0 0.12rem;
  border-radius: var(--radius-s);
  border: 1px solid var(--line-soft);
  background: var(--bg-2);
  color: var(--text);
  font-size: 0.15rem;
}
.input:focus {
  border-color: var(--cinnabar-dim);
}
.input[aria-invalid='true'] {
  border-color: var(--cinnabar-bright);
}

/* 性别分段选择 */
.seg {
  display: flex;
  gap: 0.06rem;
}
.seg-btn {
  flex: 1;
  min-height: 0.44rem;
  border-radius: var(--radius-s);
  border: 1px solid var(--line-soft);
  background: var(--bg-2);
  color: var(--text-2);
  font-size: 0.14rem;
}
.seg-btn.on {
  color: #fff;
  background: var(--cinnabar);
  border-color: transparent;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 0.08rem;
  min-height: 0.44rem;
}
.help {
  font-size: 0.11rem;
  color: var(--text-3);
  margin: 0;
  line-height: 1.6;
}
.err {
  font-size: 0.11rem;
  color: var(--cinnabar-bright);
  margin: 0;
}
.pii-warn {
  font-size: 0.11rem;
  color: var(--text-2);
  margin: 0;
}
.submit {
  min-height: 0.44rem;
  border-radius: var(--radius-pill);
  background: var(--cinnabar);
  color: #fff;
  font-size: 0.14rem;
}
.submit:active {
  opacity: 0.86;
}
</style>
