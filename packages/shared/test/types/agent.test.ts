import { describe, expect, it } from 'vitest'
import { modelRefSchema } from '@/types/agent.js'

describe('modelRefSchema', () => {
  it('应接受标准 provider/modelId', () => {
    expect(modelRefSchema.safeParse('deepseek/deepseek-v4-flash').success).toBe(true)
    expect(modelRefSchema.safeParse('openai/gpt-4o-mini').success).toBe(true)
  })

  it('应接受含空格或冒号的本地 modelId', () => {
    expect(modelRefSchema.safeParse('ollama/opus 4.8').success).toBe(true)
    expect(modelRefSchema.safeParse('ollama/llama3.1:latest').success).toBe(true)
  })

  it('应拒绝缺少斜杠或空段的引用', () => {
    expect(modelRefSchema.safeParse('invalid').success).toBe(false)
    expect(modelRefSchema.safeParse('/model-only').success).toBe(false)
    expect(modelRefSchema.safeParse('provider/').success).toBe(false)
  })
})
