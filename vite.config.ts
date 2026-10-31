import { existsSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * 发布仓库不提供 DOCS/（对拍数据与内容母版仅存在于本地工作区）。
 * 数据缺失时，依赖它的用例不参与本次运行，并在启动日志里显式提示，
 * 避免「静默全绿」。
 */
const goldenDir = fileURLToPath(new URL('./DOCS/golden', import.meta.url))
const iztroDump = fileURLToPath(new URL('./DOCS/iztro-main/iztro-main/ziwei-dump-full.json', import.meta.url))
const skippedSpecs: string[] = []
if (!existsSync(goldenDir)) {
  skippedSpecs.push(
    'tests/golden/**',
    'tests/iching-taibu-golden.spec.ts',
    'tests/taibu-meihua-qimen-golden.spec.ts',
    'tests/liujiao-najia-check.spec.ts'
  )
}
if (!existsSync(iztroDump)) skippedSpecs.push('tests/engine/ziwei-iztro-crosscheck.spec.ts')
if (skippedSpecs.length > 0) {
  console.warn(
    `[jiyi] 未检测到 DOCS 对拍数据，以下用例本次不运行：\n  ${skippedSpecs.join('\n  ')}\n` +
      '（发布仓库不提供对拍数据；需要完整校验请使用包含 DOCS/ 的本地工作区）'
  )
}

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    target: 'es2020',
    // 内容 JSON 体积见 JY-03 §11：超过此值告警
    chunkSizeWarningLimit: 800
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.spec.ts', 'src/**/*.spec.ts'],
    exclude: skippedSpecs
  }
})
