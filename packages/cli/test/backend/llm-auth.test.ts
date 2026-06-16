import { describe, expect, it } from 'vitest'
import { withProxyBaseUrl } from '@/backend/llm-auth.js'

describe('withProxyBaseUrl', () => {
  it('deepseek 经 Muse 代理时应禁用 developer role', () => {
    const proxied = withProxyBaseUrl(
      {
        provider: 'deepseek',
        baseUrl: 'https://api.deepseek.com',
        compat: { thinkingFormat: 'deepseek', requiresReasoningContentOnAssistantMessages: true },
      },
      'http://127.0.0.1:65435',
    )

    expect(proxied.baseUrl).toBe('http://127.0.0.1:65435/v1')
    expect(proxied.compat?.supportsDeveloperRole).toBe(false)
    expect(proxied.compat?.thinkingFormat).toBe('deepseek')
  })

  it('openai 经 Muse 代理时不应强制禁用 developer role', () => {
    const proxied = withProxyBaseUrl(
      {
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
      },
      'http://127.0.0.1:65435',
    )

    expect(proxied.compat?.supportsDeveloperRole).toBeUndefined()
  })

  it('应保留 model.compat 中显式设置的 supportsDeveloperRole', () => {
    const proxied = withProxyBaseUrl(
      {
        provider: 'deepseek',
        baseUrl: 'https://api.deepseek.com',
        compat: { supportsDeveloperRole: true },
      },
      'http://127.0.0.1:65435',
    )

    expect(proxied.compat?.supportsDeveloperRole).toBe(true)
  })
})
