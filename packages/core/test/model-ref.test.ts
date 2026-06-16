import { describe, expect, it } from 'vitest'
import { parseModelRef } from '@/model-ref.js'

describe('parseModelRef', () => {
  it('应将 openai/deepseek-v4-flash 解析为 deepseek 供应方', () => {
    const model = parseModelRef('openai/deepseek-v4-flash')
    expect(model.provider).toBe('deepseek')
    expect(model.id).toBe('deepseek-v4-flash')
  })

  it('应直接解析 deepseek/deepseek-v4-pro', () => {
    const model = parseModelRef('deepseek/deepseek-v4-pro')
    expect(model.provider).toBe('deepseek')
    expect(model.id).toBe('deepseek-v4-pro')
  })
})
