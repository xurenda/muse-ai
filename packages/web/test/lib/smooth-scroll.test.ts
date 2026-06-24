import { describe, expect, it } from 'vitest'
import { clampScrollTop } from '@/lib/smooth-scroll'

describe('clampScrollTop', () => {
  it('将目标位置限制在可滚动范围内', () => {
    const container = {
      scrollHeight: 1000,
      clientHeight: 400,
    } as HTMLElement

    expect(clampScrollTop(container, -20)).toBe(0)
    expect(clampScrollTop(container, 300)).toBe(300)
    expect(clampScrollTop(container, 900)).toBe(600)
  })
})
