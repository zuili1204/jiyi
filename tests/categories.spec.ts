import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CATEGORIES } from '@/data/categories'

/**
 * 抽离后的共享品类元数据（JY-14 T3-1 / §7.2）
 * HomeView 与教程页同源引用，防止万分漂移；此处把「共享的唯一源」钉死。
 */
describe('共享品类元数据 categories.ts', () => {
  it('恰好六个玩法，且 key/name/desc/ready 齐全', () => {
    expect(CATEGORIES.length).toBe(6)
    const keys = CATEGORIES.map((c) => c.key)
    expect(keys).toContain('lots')
    expect(keys).toContain('liujiao')
    expect(keys).toContain('meihua')
    expect(keys).toContain('bazi')
    expect(keys).toContain('ziwei')
    expect(keys).toContain('qimen')
    for (const c of CATEGORIES) {
      expect(typeof c.name).toBe('string')
      expect(typeof c.desc).toBe('string')
      expect(typeof c.ready).toBe('boolean')
    }
  })

  it('HomeView.vue 不再内联 CATEGORIES，改引用共享源（防两份漂移）', () => {
    const home = readFileSync(join(process.cwd(), 'src', 'views', 'HomeView.vue'), 'utf8')
    // 不再定义 const CATEGORIES = [ { key:'lots',...
    expect(home).not.toMatch(/\bcategories\.\.\./i)
    expect(home).toMatch(/import\s+\{\s*CATEGORIES\s*\}\s+from\s+'@\/data\/categories'/)
    // 不再内联 name 表（防 home 里还有一份 6 项数组）
    expect(home).not.toMatch(/key:\s*'lots'/)
  })

  it('教程页引用同一份（防教程与首页各写一份名称）', () => {
    const tutorialView = readFileSync(
      join(process.cwd(), 'src', 'views', 'TutorialView.vue'),
      'utf8'
    )
    // 教程六玩法定义在 data 层，view 不手写 key 数组
    expect(tutorialView).toMatch(/from\s+'@\/data\/content\/tutorial'/)
  })
})