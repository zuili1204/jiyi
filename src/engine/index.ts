/**
 * 引擎集中注册入口（JY-03 §5 唯一多态分发点）
 *
 * 任何引擎模块在此被导入即完成 registerEngine 副作用。
 * 应用启动时只需 `import '@/engine'` 一次即可注册全部引擎。
 */
import './coin'
import './lots'
import './iching'
import './bazi'
import './ziwei'
import './qimen'

export { listEngines, getEngine, requireEngine } from './registry'
export type { DivinationEngine, Interpretation, RandomSource } from './types'
