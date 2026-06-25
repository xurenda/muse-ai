import { describe, expect, it } from 'vitest'
import { DEFAULT_MODEL_STRATEGY, encodeModelSelectionHeader, parseModelSelectionHeader, parseMuseLlmTask, parseProviderIdFromModelRef } from '@museai/shared'

describe('encodeModelSelectionHeader / parseModelSelectionHeader', () => {
  it('tier selection 应往返', () => {
    const selection = { type: 'tier' as const, tier: 'high' as const }
    expect(parseModelSelectionHeader(encodeModelSelectionHeader(selection))).toEqual(selection)
  })

  it('model selection 应往返', () => {
    const selection = { type: 'model' as const, modelRef: 'openai/gpt-4o-mini' }
    expect(parseModelSelectionHeader(encodeModelSelectionHeader(selection))).toEqual(selection)
  })

  it('非法格式应返回 null', () => {
    expect(parseModelSelectionHeader('auto:high')).toBeNull()
    expect(parseModelSelectionHeader('tier:unknown')).toBeNull()
    expect(parseModelSelectionHeader('model:')).toBeNull()
  })
})

describe('parseMuseLlmTask', () => {
  it('应识别合法 task', () => {
    expect(parseMuseLlmTask('chat')).toBe('chat')
    expect(parseMuseLlmTask('compaction')).toBe('compaction')
    expect(parseMuseLlmTask('titleGeneration')).toBe('titleGeneration')
  })

  it('非法 task 应返回 null', () => {
    expect(parseMuseLlmTask('unknown')).toBeNull()
    expect(parseMuseLlmTask(null)).toBeNull()
  })
})

describe('parseProviderIdFromModelRef', () => {
  it('应解析 providerId', () => {
    expect(parseProviderIdFromModelRef('openai/gpt-4o')).toBe('openai')
  })

  it('非法 modelRef 应返回 null', () => {
    expect(parseProviderIdFromModelRef('invalid')).toBeNull()
  })
})

describe('DEFAULT_MODEL_STRATEGY', () => {
  it('默认 chat 应为 medium tier', () => {
    expect(DEFAULT_MODEL_STRATEGY.taskRouting.chat).toEqual({ type: 'tier', tier: 'medium' })
  })
})
