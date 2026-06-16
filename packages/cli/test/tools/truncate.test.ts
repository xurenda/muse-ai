import { describe, expect, it } from 'vitest'
import { DEFAULT_MAX_BYTES, truncateHead, truncateTail } from '@/tools/truncate.js'

describe('truncate', () => {
  it('truncateHead 在限制内不截断', () => {
    const content = 'a\nb\nc'
    const result = truncateHead(content, { maxLines: 10, maxBytes: 1024 })
    expect(result.truncated).toBe(false)
    expect(result.content).toBe(content)
  })

  it('truncateHead 按行数截断', () => {
    const content = '1\n2\n3\n4\n5'
    const result = truncateHead(content, { maxLines: 3, maxBytes: 1024 })
    expect(result.truncated).toBe(true)
    expect(result.truncatedBy).toBe('lines')
    expect(result.content).toBe('1\n2\n3')
  })

  it('truncateHead 首行超字节限制时标记 firstLineExceedsLimit', () => {
    const line = 'x'.repeat(DEFAULT_MAX_BYTES + 10)
    const result = truncateHead(line, { maxLines: 100, maxBytes: DEFAULT_MAX_BYTES })
    expect(result.firstLineExceedsLimit).toBe(true)
    expect(result.content).toBe('')
  })

  it('truncateTail 保留末尾行', () => {
    const content = '1\n2\n3\n4\n5'
    const result = truncateTail(content, { maxLines: 2, maxBytes: 1024 })
    expect(result.truncated).toBe(true)
    expect(result.content).toBe('4\n5')
  })
})
