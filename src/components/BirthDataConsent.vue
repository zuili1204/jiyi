<script setup lang="ts">
/**
 * 出生数据保存授权（Y4-04 / J4）
 *
 * 硬纪律：**未点同意，绝不落盘任何出生数据**。
 * 排盘可以照算给人看（计算是纯本地的），但写入存储这一步必须等授权。
 *
 * 文案与 `DOCS/legal/隐私政策.md` 同源（收集什么 / 用途 / 不上传 / 留存 / 可撤回），
 * 不在组件里另写一套"看起来更温和"的说法。
 */
const emit = defineEmits<{ (e: 'resolve', agreed: boolean): void }>()
</script>

<template>
  <section class="consent" role="dialog" aria-label="出生数据保存授权">
    <h3>保存出生数据？</h3>
    <p class="lead">
      八字 / 紫微需要出生时刻才能排盘。计算在本机完成；是否把这些数据存下来，由你决定。
    </p>
    <ul>
      <li>收集：出生时刻、出生地、性别（仅命理品类）</li>
      <li>用途：只用于在本机排盘，不上传、不共享、不做画像</li>
      <li>留存：存于本机，可随时删除或清空，卸载即清除</li>
      <li>导出：默认剔除出生数据；撤回授权后不再写入新的出生数据</li>
    </ul>
    <p class="note">
      选择「暂不」也能看到排盘结果，但本次结果不会存入记录。
    </p>
    <div class="acts">
      <button type="button" class="ghost" @click="emit('resolve', false)">暂不</button>
      <button type="button" class="solid" @click="emit('resolve', true)">同意保存</button>
    </div>
  </section>
</template>

<style scoped>
.consent {
  margin-top: 0.12rem;
  padding: 0.14rem;
  border-radius: var(--radius);
  border: 1px solid var(--cinnabar-dim);
  background: var(--panel);
}
h3 {
  font-size: 0.15rem;
  margin-bottom: 0.06rem;
}
.lead {
  font-size: 0.13rem;
  line-height: 1.7;
  color: var(--text-2);
}
ul {
  margin: 0.08rem 0 0;
  padding-left: 0.18rem;
  font-size: 0.12rem;
  line-height: 1.8;
  color: var(--text-2);
}
.note {
  margin-top: 0.08rem;
  font-size: 0.12rem;
  color: var(--text-3);
  line-height: 1.7;
}
.acts {
  display: flex;
  gap: 0.08rem;
  margin-top: 0.12rem;
}
.acts button {
  flex: 1;
  min-height: 0.44rem;
  border-radius: var(--radius-pill);
  font-size: 0.14rem;
}
.ghost {
  border: 1px solid var(--line-soft);
  color: var(--text-2);
}
.solid {
  background: var(--cinnabar);
  color: #fff;
}
</style>
