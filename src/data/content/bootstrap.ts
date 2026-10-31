import { setLotsContentProvider } from '@/engine/lots'
import { setIchingTextProvider, setIchingTemplateProvider, setIchingYiLiProvider } from '@/engine/iching'
import { setBaziDuanProvider } from '@/engine/bazi'
import { setZiweiPalaceProvider } from '@/engine/ziwei'
import { setQimenTemplateProvider } from '@/engine/qimen'
import { getLotEntry, type LotKind } from './lots'
import {
  getHexagramText,
  getIchingTemplate,
  getIchingTemplateOverall,
  ICHING_TPL_META,
  getYiLiEntries
} from './iching'
import { getBaziDuanEntries, BAZI_DUAN_META } from './bazi'
import { getPalaceStarEntry, getPalaceDualEntry } from './ziwei'
import { getQimenTemplate, getQimenTemplateOverall, QIMEN_TPL_META } from './qimen'

/**
 * 内容引导：在应用启动时把已采集的母版注入各引擎的内容提供方。
 * 集中此处，避免在各 views 里散落内容装配逻辑（JY-03 §5）。
 */
export function bootstrapContent(): void {
  setLotsContentProvider((index: number, kind?: string) =>
    getLotEntry(index, (kind ?? 'guanyin') as LotKind)
  )
  setIchingTextProvider(getHexagramText)
  setIchingTemplateProvider((ctx) => {
    const items = []
    const pick = (dim: 'meihua' | 'yongShen', key?: string) => {
      if (!key) return undefined
      const it = getIchingTemplate(dim, key)
      if (it) {
        items.push({
          id: it.id,
          key: it.key,
          label: it.label,
          text: it.text,
          reviewed: ICHING_TPL_META.reviewed,
          source: { name: ICHING_TPL_META.source, license: ICHING_TPL_META.license }
        })
      }
    }
    pick('meihua', ctx.meihuaKey)
    pick('yongShen', ctx.yongShenKey)
    const overall = getIchingTemplateOverall()
    if (overall) {
      items.push({
        id: overall.id,
        key: overall.key,
        label: overall.label,
        text: overall.text,
        reviewed: ICHING_TPL_META.reviewed,
        source: { name: ICHING_TPL_META.source, license: ICHING_TPL_META.license }
      })
    }
    return items
  })
  setIchingYiLiProvider((idx) => getYiLiEntries(idx))
  setBaziDuanProvider((ctx) =>
    getBaziDuanEntries({
      weak: ctx.weak,
      moderate: ctx.moderate,
      shiShen: ctx.monthShiShen
    }).map((e) => ({
      id: e.id,
      title: e.title,
      text: e.text,
      reviewed: BAZI_DUAN_META.reviewed,
      source: { name: BAZI_DUAN_META.source, license: BAZI_DUAN_META.license }
    }))
  )
  // Y6-06：奇门问事解读 / 择时择方模板（只给取用口径介绍，不写断语）
  setQimenTemplateProvider((ctx) => {
    const out: {
      id: string
      dim: 'wenShi' | 'yongMen' | 'fangWei' | 'zeShi' | 'overall'
      key: string
      label: string
      text: string
      reviewed: boolean
      source: { name: string; license: string }
    }[] = []
    const push = (
      dim: 'wenShi' | 'yongMen' | 'fangWei' | 'zeShi' | 'overall',
      key: string
    ) => {
      const it = getQimenTemplate(dim, key)
      if (it) {
        out.push({
          id: it.id,
          dim,
          key: it.key,
          label: it.label,
          text: it.text,
          reviewed: QIMEN_TPL_META.reviewed,
          source: { name: QIMEN_TPL_META.source, license: QIMEN_TPL_META.license }
        })
      }
    }
    // 问事类别不自动推断：未显式指定即按「综合口径」呈现
    push('wenShi', ctx.wenShiKey ?? 'zonghe')
    for (const m of ctx.menKeys ?? []) push('yongMen', m)
    for (const p of ctx.palaceKeys ?? []) push('fangWei', p)
    push('zeShi', 'overall')
    const overall = getQimenTemplateOverall()
    if (overall) {
      out.push({
        id: overall.id,
        dim: 'overall',
        key: overall.key,
        label: overall.label,
        text: overall.text,
        reviewed: QIMEN_TPL_META.reviewed,
        source: { name: QIMEN_TPL_META.source, license: QIMEN_TPL_META.license }
      })
    }
    return out
  })
  setZiweiPalaceProvider((palaces) => {
    const out = []
    for (const p of palaces) {
      const stars = p.mainStars
      if (stars.length === 0) continue
      if (stars.length === 1) {
        const it = getPalaceStarEntry(stars[0], p.name)
        if (it) {
          out.push({
            id: it.id,
            kind: it.kind,
            star: it.star,
            gong: it.gong,
            text: it.text
          })
        }
      } else {
        // 双星同宫：整串双星名（如「紫微天府」）取双星条目
        const dualName = stars.join('')
        const it = getPalaceStarEntry(dualName, p.name) || getPalaceDualEntry(dualName, p.name)
        if (it) {
          out.push({
            id: it.id,
            kind: it.kind,
            star: it.star || dualName,
            gong: it.gong,
            text: it.text
          })
        }
      }
    }
    return out
  })
}
