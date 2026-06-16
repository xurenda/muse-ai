import { describe, expect, it } from 'vitest'
import { deriveSessionTitle } from '../src/session-title.js'

describe('deriveSessionTitle', () => {
  it('应折叠空白并保留短消息', () => {
    expect(deriveSessionTitle('  你好   世界  ')).toBe('你好 世界')
  })

  it('超长消息应截断并加省略号', () => {
    const long = 'a'.repeat(100)
    expect(deriveSessionTitle(long)).toBe(`${'a'.repeat(79)}…`)
  })
})
