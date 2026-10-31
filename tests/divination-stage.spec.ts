import { createApp } from 'vue'
import DivinationStage from '@/components/divination/DivinationStage.vue'

/**
 * 六玩法过程动画（DivinationStage + 六场景）单元验收：
 * - 循环段：各玩法渲染自己的过程元素（签筒 / 铜钱 / 卦符 / 天盘），不出结果；
 * - 落定段：用真实结果定格（签号 / 六爻堆叠 / 体用 / 四柱 / 十二宫 / 定局）。
 * 纯展示组件，不引 Pinia / 路由，直接挂载即可；CSS 动画在 jsdom 不运行，
 * 断言的是结构与内容（落定段的基础态即最终态，降级时同构可见）。
 */
type StageProps = {
  mode: string
  phase: 'loop' | 'settle'
  label: string
  data?: Record<string, unknown>
}

function mountStage(props: StageProps) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const app = createApp(DivinationStage, props)
  app.mount(el)
  return { el, app }
}

afterEach(() => {
  document.body.innerHTML = ''
})

it('循环段（签占）：签筒在摇，不出签', () => {
  const { el, app } = mountStage({ mode: 'lots', phase: 'loop', label: '摇签中…' })
  expect(el.querySelector('.lots .tube-zone.loop')).toBeTruthy()
  expect(el.querySelectorAll('.lots .stick').length).toBe(7)
  expect(el.querySelector('.riser')).toBeNull()
  expect(el.textContent).toContain('摇签中…')
  app.unmount()
})

it('落定段（签占）：一支签升起并带出真实签号', () => {
  const { el, app } = mountStage({
    mode: 'lots',
    phase: 'settle',
    label: '签已出',
    data: { index: 42 }
  })
  expect(el.querySelector('.lots .riser')).toBeTruthy()
  expect(el.textContent).toContain('第 42 签')
  app.unmount()
})

it('落定段（六爻）：六爻自下而上堆叠，动爻有标记', () => {
  const { el, app } = mountStage({
    mode: 'liujiao',
    phase: 'settle',
    label: '卦已成',
    data: {
      cast: { lines: [true, true, false, true, false, false], dongYao: [2], benGua: { name: '震为雷' } }
    }
  })
  expect(el.querySelectorAll('.yao').length).toBe(6)
  expect(el.querySelectorAll('.yao.dong').length).toBe(1)
  // 阳爻整条 / 阴爻两段：3 阳 3 阴
  expect(el.querySelectorAll('.bar.full').length).toBe(3)
  expect(el.querySelectorAll('.bar.half').length).toBe(6)
  expect(el.textContent).toContain('震为雷')
  app.unmount()
})

it('落定段（梅花）：本卦定格且体用分列', () => {
  const { el, app } = mountStage({
    mode: 'meihua',
    phase: 'settle',
    label: '象已现',
    data: {
      cast: { lines: [true, false, true, true, false, false], dongYao: [5] },
      meihua: {
        benGua: { name: '火雷噬嗑', upper: '离', lower: '震' },
        ti: { trigram: '震' },
        yong: { trigram: '离' }
      }
    }
  })
  expect(el.querySelectorAll('.yao').length).toBe(6)
  const t = el.textContent ?? ''
  // 动爻在上三爻 → 上卦为用
  expect(t).toContain('用 · 离')
  expect(t).toContain('体 · 震')
  expect(t).toContain('火雷噬嗑')
  app.unmount()
})

it('落定段（八字）：四柱立起，干支入位', () => {
  const { el, app } = mountStage({
    mode: 'bazi',
    phase: 'settle',
    label: '四柱已立',
    data: {
      pillars: {
        year: { gan: '丙', zhi: '午' },
        month: { gan: '甲', zhi: '午' },
        day: { gan: '丁', zhi: '未' },
        time: { gan: '戊', zhi: '申' }
      }
    }
  })
  expect(el.querySelectorAll('.pillar:not(.ghost)').length).toBe(4)
  const t = el.textContent ?? ''
  expect(t).toContain('丙')
  expect(t).toContain('申')
  expect(t).toContain('年')
  app.unmount()
})

it('落定段（紫微）：十二宫点亮，命宫高亮，主星缀星子', () => {
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
  const twelveGong = branches.map((b, i) => ({ name: i === 0 ? '命宫' : `宫${i}`, branch: b }))
  const { el, app } = mountStage({
    mode: 'ziwei',
    phase: 'settle',
    label: '星已安',
    data: { mingGong: { twelveGong }, zhuXing: { mainStars: { 子: ['紫微'] } } }
  })
  expect(el.querySelectorAll('.cell').length).toBe(12)
  expect(el.querySelectorAll('.cell.ming').length).toBe(1)
  expect(el.querySelectorAll('.cell.starred').length).toBe(1)
  app.unmount()
})

it('落定段（奇门）：天盘盖下，九宫点亮，定局浮现', () => {
  const { el, app } = mountStage({
    mode: 'qimen',
    phase: 'settle',
    label: '局已定',
    data: { dingJu: { dun: 'yang', ju: 3 } }
  })
  expect(el.querySelector('.ring.land')).toBeTruthy()
  expect(el.querySelectorAll('.grid .cell').length).toBe(9)
  expect(el.textContent).toContain('阳遁三局')
  app.unmount()
})

it('循环段（奇门）：天盘在转，不露定局', () => {
  const { el, app } = mountStage({ mode: 'qimen', phase: 'loop', label: '转盘中…' })
  expect(el.querySelector('.ring.land')).toBeNull()
  expect(el.querySelector('.ring')).toBeTruthy()
  expect(el.textContent).not.toContain('局')
  app.unmount()
})

it('循环段（六爻）：三枚铜钱在翻，不出卦', () => {
  const { el, app } = mountStage({ mode: 'liujiao', phase: 'loop', label: '摇卦中…' })
  expect(el.querySelector('.coins.loop')).toBeTruthy()
  expect(el.querySelectorAll('.c').length).toBe(3)
  expect(el.querySelector('.hex-wrap')).toBeNull()
  app.unmount()
})
