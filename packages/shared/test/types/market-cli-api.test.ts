import { describe, expect, it } from 'vitest'
import { marketInstallRequestSchema, personasListResponseSchema } from '@/types/market-cli-api.js'

describe('market-cli-api', () => {
  it('marketInstallRequestSchema 应校验 packageId', () => {
    const parsed = marketInstallRequestSchema.safeParse({ packageId: 'museai/basic-kit' })
    expect(parsed.success).toBe(true)
    expect(marketInstallRequestSchema.safeParse({ packageId: 'invalid' }).success).toBe(false)
  })

  it('personasListResponseSchema 应包含 source 字段', () => {
    const parsed = personasListResponseSchema.safeParse({
      personas: [
        {
          id: 'museai/basic-kit/general',
          name: '通用',
          source: 'market',
        },
      ],
    })
    expect(parsed.success).toBe(true)
  })
})
