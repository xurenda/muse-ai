import { describe, expect, it } from 'vitest'
import {
  addPoolItem,
  decodeModelSelection,
  decodeTaskModelSelection,
  encodeModelSelection,
  encodeTaskModelSelection,
  isSameModelSelection,
  movePoolItem,
  removePoolItem,
  reorderPoolItems,
  resolveOptimisticModelRef,
  resolveDisplayModelRef,
  resolvePickerTriggerLabels,
  togglePoolItem,
} from '@/utils/model-strategy-ui'

const catalog = [
  {
    modelRef: 'openai/deepseek-v4-flash',
    providerId: 'openai',
    providerName: 'OpenAI',
    modelId: 'deepseek-v4-flash',
    modelName: 'DeepSeek V4 Flash',
  },
  {
    modelRef: 'openai/deepseek-v4-pro',
    providerId: 'openai',
    providerName: 'OpenAI',
    modelId: 'deepseek-v4-pro',
    modelName: 'DeepSeek V4 Pro',
  },
]

describe('model-strategy-ui', () => {
  it('encode/decode tier selection', () => {
    const encoded = encodeModelSelection({ type: 'tier', tier: 'high' })
    expect(decodeModelSelection(encoded, catalog)).toEqual({ type: 'tier', tier: 'high' })
  })

  it('encode/decode model selection', () => {
    const encoded = encodeModelSelection({ type: 'model', modelRef: 'openai/deepseek-v4-flash' })
    expect(decodeModelSelection(encoded, catalog)).toEqual({ type: 'model', modelRef: 'openai/deepseek-v4-flash' })
  })

  it('decodeTaskModelSelection 应支持 follow_chat', () => {
    expect(decodeTaskModelSelection('follow_chat', catalog, true)).toEqual({ type: 'follow_chat' })
    expect(encodeTaskModelSelection({ type: 'follow_chat' })).toBe('follow_chat')
  })

  it('movePoolItem 应调整顺序', () => {
    expect(movePoolItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
  })

  it('reorderPoolItems 与 movePoolItem 语义一致', () => {
    expect(reorderPoolItems(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
  })

  it('add/remove pool item', () => {
    expect(addPoolItem(['a'], 'b')).toEqual(['a', 'b'])
    expect(addPoolItem(['a'], 'a')).toEqual(['a'])
    expect(removePoolItem(['a', 'b'], 0)).toEqual(['b'])
  })

  it('togglePoolItem 应切换成员', () => {
    expect(togglePoolItem(['a'], 'b')).toEqual(['a', 'b'])
    expect(togglePoolItem(['a', 'b'], 'a')).toEqual(['b'])
  })

  it('isSameModelSelection 应区分 tier 与 model', () => {
    expect(isSameModelSelection({ type: 'tier', tier: 'high' }, { type: 'tier', tier: 'high' })).toBe(true)
    expect(isSameModelSelection({ type: 'tier', tier: 'high' }, { type: 'tier', tier: 'medium' })).toBe(false)
    expect(isSameModelSelection({ type: 'model', modelRef: 'openai/deepseek-v4-flash' }, { type: 'tier', tier: 'high' })).toBe(false)
    expect(isSameModelSelection(undefined, undefined)).toBe(true)
  })

  it('resolvePickerTriggerLabels tier 时副文案为解析模型', () => {
    const labels = resolvePickerTriggerLabels({ type: 'tier', tier: 'high' }, 'openai/deepseek-v4-pro', catalog, tier => (tier === 'high' ? '高' : tier))
    expect(labels).toEqual({ primary: '高', secondary: 'DeepSeek V4 Pro' })
  })

  it('resolvePickerTriggerLabels model 时仅主文案', () => {
    const labels = resolvePickerTriggerLabels({ type: 'model', modelRef: 'openai/deepseek-v4-flash' }, 'openai/deepseek-v4-flash', catalog, () => '')
    expect(labels).toEqual({ primary: 'DeepSeek V4 Flash', secondary: null })
  })

  it('resolveOptimisticModelRef tier 应取池内首个已配置模型', () => {
    const pools = { high: ['openai/missing', 'openai/deepseek-v4-pro'], medium: [], low: [] }
    expect(resolveOptimisticModelRef({ type: 'tier', tier: 'high' }, pools, catalog)).toBe('openai/deepseek-v4-pro')
  })

  it('resolveDisplayModelRef SSE 应覆盖乐观值', () => {
    expect(
      resolveDisplayModelRef(
        { type: 'tier', tier: 'high' },
        {
          sseResolvedModelRef: 'openai/deepseek-v4-flash',
          optimisticModelRef: 'openai/deepseek-v4-pro',
        },
      ),
    ).toBe('openai/deepseek-v4-flash')
  })

  it('resolveDisplayModelRef tier 无 SSE 时用乐观池首项', () => {
    expect(
      resolveDisplayModelRef(
        { type: 'tier', tier: 'high' },
        {
          optimisticModelRef: 'openai/deepseek-v4-pro',
        },
      ),
    ).toBe('openai/deepseek-v4-pro')
  })

  it('resolveDisplayModelRef tier persisted 在池内时优先于乐观首项', () => {
    expect(
      resolveDisplayModelRef(
        { type: 'tier', tier: 'high' },
        {
          optimisticModelRef: 'openai/deepseek-v4-pro',
          persistedModelRef: 'openai/deepseek-v4-flash',
          tierPool: ['openai/deepseek-v4-pro', 'openai/deepseek-v4-flash'],
        },
      ),
    ).toBe('openai/deepseek-v4-flash')
  })

  it('resolveDisplayModelRef tier persisted 不在当前池内时应回退乐观首项', () => {
    expect(
      resolveDisplayModelRef(
        { type: 'tier', tier: 'medium' },
        {
          optimisticModelRef: 'openai/medium-model',
          persistedModelRef: 'openai/high-only',
          tierPool: ['openai/medium-model'],
        },
      ),
    ).toBe('openai/medium-model')
  })
})
