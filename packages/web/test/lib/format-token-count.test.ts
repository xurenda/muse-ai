import { describe, expect, it } from 'vitest'
import { formatTokenCount } from '@/lib/format-token-count.js'

describe('formatTokenCount', () => {
  it('应格式化不同量级的 token 数', () => {
    expect(formatTokenCount(42)).toBe('42')
    expect(formatTokenCount(1500)).toBe('1.5k')
    expect(formatTokenCount(12_345)).toBe('12k')
    expect(formatTokenCount(1_500_000)).toBe('1.5M')
  })
})
