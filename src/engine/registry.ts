import type { DivinationEngine, DivinationKind } from './types'

/**
 * 引擎注册表：唯一的多态分发点（JY-03 §5）
 *
 * 纪律：禁止在 views 里写 `if (kind === ...)`，一律走注册表。
 */

const registry = new Map<string, DivinationEngine<any, any>>()

export function registerEngine(engine: DivinationEngine<any, any>): void {
  const key = `${engine.kind}.${engine.method}`
  if (registry.has(key)) {
    throw new Error(`引擎重复注册：${key}`)
  }
  registry.set(key, engine)
}

export function getEngine(
  kind: DivinationKind,
  method: string
): DivinationEngine<any, any> | undefined {
  return registry.get(`${kind}.${method}`)
}

export function requireEngine(kind: DivinationKind, method: string): DivinationEngine<any, any> {
  const e = getEngine(kind, method)
  if (!e) throw new Error(`未注册的引擎：${kind}.${method}`)
  return e
}

export function listEngines(): DivinationEngine<any, any>[] {
  return [...registry.values()]
}

/** 仅供测试：清空注册表 */
export function __clearRegistry(): void {
  registry.clear()
}
