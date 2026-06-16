import { describe, expect, it } from 'vitest'
import { resolveIsDark } from '@/utils/apply-theme'

describe('resolveIsDark', () => {
  it('light 模式返回 false', () => {
    expect(resolveIsDark('light')).toBe(false)
  })

  it('dark 模式返回 true', () => {
    expect(resolveIsDark('dark')).toBe(true)
  })
})
