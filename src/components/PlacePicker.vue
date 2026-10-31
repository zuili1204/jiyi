<script setup lang="ts">
/**
 * 出生地选择器（Y4-04）
 *
 * 两条路径都要能用：
 * 1. 选内置城市（模糊联想）；
 * 2. 内置表没收录时**手填经度** —— 不能给一个"看起来合理"的默认值（YR2）。
 *
 * 经度表 `reviewed: false` 时明确提示"待复核"，让误差可见（YR21），
 * 而不是让用户以为这就是权威值。
 */
import { computed, ref } from 'vue'
import { isGeoReviewed, lookupCity, resolveLongitude, searchCities } from '@/data/geo'

const props = defineProps<{
  id?: string
  modelValue?: string
  placeholder?: string
}>()

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const open = ref(false)
const value = computed(() => props.modelValue ?? '')

/** 仅在聚焦时给联想，避免一进页面就弹出长列表 */
const matches = computed(() => (open.value ? searchCities(value.value, 8) : []))

/** 当前值的解析状态：命中城市 / 手填经度 / 不认识 */
const status = computed(() => {
  const v = value.value.trim()
  if (!v) return { kind: 'empty' as const, text: '' }
  const city = lookupCity(v)
  if (city) {
    return { kind: 'city' as const, text: `已收录：${city.name} · 东经 ${city.lon}°` }
  }
  const lon = resolveLongitude(v)
  if (lon !== undefined) {
    return { kind: 'lon' as const, text: `按手填经度 ${lon}° 订正` }
  }
  return { kind: 'unknown' as const, text: '经度表未收录，请改填经度数字（如 116.4）' }
})

const geoReviewed = isGeoReviewed()

function set(v: string) {
  emit('update:modelValue', v)
}

function pick(name: string) {
  set(name)
  open.value = false
}

function onBlur() {
  open.value = false
}
</script>

<template>
  <div class="place">
    <input
      :id="id"
      class="input"
      type="text"
      role="combobox"
      aria-autocomplete="list"
      :aria-expanded="open"
      :aria-describedby="id ? `${id}-status` : undefined"
      :placeholder="placeholder ?? '如：北京（无收录时直接填经度 116.4）'"
      :value="value"
      @input="set(($event.target as HTMLInputElement).value); open = true"
      @focus="open = true"
      @blur="onBlur"
    />

    <ul v-if="open && matches.length" class="menu" role="listbox">
      <li v-for="c in matches" :key="c.id">
        <button
          type="button"
          class="opt"
          role="option"
          :aria-selected="c.name === value"
          @mousedown.prevent="pick(c.name)"
        >
          <span>{{ c.name }}</span>
          <span class="opt-lon">东经 {{ c.lon }}°</span>
        </button>
      </li>
    </ul>

    <p
      v-if="status.text"
      :id="id ? `${id}-status` : undefined"
      class="status"
      :class="status.kind"
      aria-live="polite"
    >
      {{ status.text }}
    </p>
    <p v-if="!geoReviewed" class="status meta">部分地点经度暂按近似值，结果仅供参考。</p>
  </div>
</template>

<style scoped>
.place {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.04rem;
}
.input {
  min-height: 0.44rem;
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
.menu {
  position: absolute;
  z-index: 5;
  top: 0.46rem;
  left: 0;
  right: 0;
  max-height: 1.8rem;
  overflow-y: auto;
  margin: 0;
  padding: 0.04rem;
  list-style: none;
  border-radius: var(--radius-s);
  border: 1px solid var(--line);
  background: var(--panel-solid, var(--panel));
  box-shadow: var(--shadow, 0 0.06rem 0.2rem rgba(0, 0, 0, 0.35));
}
.opt {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.08rem;
  width: 100%;
  min-height: 0.4rem;
  padding: 0 0.08rem;
  border-radius: var(--radius-s);
  color: var(--text);
  font-size: 0.13rem;
  text-align: left;
}
.opt:hover {
  background: var(--bg-2);
}
.opt-lon {
  color: var(--text-3);
  font-size: 0.11rem;
}
.status {
  margin: 0;
  font-size: 0.11rem;
  line-height: 1.6;
  color: var(--text-3);
}
.status.city,
.status.lon {
  color: var(--text-2);
}
.status.unknown {
  color: var(--cinnabar-bright);
}
.status.meta {
  color: var(--text-3);
}
</style>
