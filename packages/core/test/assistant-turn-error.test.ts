import { describe, expect, it } from 'vitest'
import type { AssistantMessage } from '@earendil-works/pi-ai'
import { extractAssistantTurnError, formatLlmErrorMessage } from '@/assistant-turn-error.js'

function createAssistantMessage(overrides: Partial<AssistantMessage>): AssistantMessage {
  return {
    role: 'assistant',
    content: [],
    api: 'openai-completions',
    provider: 'openai',
    model: 'test-model',
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    stopReason: 'stop',
    timestamp: Date.now(),
    ...overrides,
  }
}

describe('formatLlmErrorMessage', () => {
  it('应将 no_provider 转为配置指引', () => {
    expect(formatLlmErrorMessage('503 "no_provider"')).toContain('未配置 LLM Provider')
  })
})

describe('extractAssistantTurnError', () => {
  it('stopReason 为 error 时应返回格式化后的 errorMessage', () => {
    const message = createAssistantMessage({
      stopReason: 'error',
      errorMessage: '503 "no_provider"',
    })
    expect(extractAssistantTurnError(message)).toContain('未配置 LLM Provider')
  })

  it('stopReason 为 stop 时不应返回错误', () => {
    const message = createAssistantMessage({ stopReason: 'stop' })
    expect(extractAssistantTurnError(message)).toBeNull()
  })

  it('stopReason 为 aborted 时不应返回错误', () => {
    const message = createAssistantMessage({ stopReason: 'aborted' })
    expect(extractAssistantTurnError(message)).toBeNull()
  })
})
