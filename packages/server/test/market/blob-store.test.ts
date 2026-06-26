import { describe, expect, it } from 'vitest'
import { toBlobRelativePath } from '@/market/blob-store.js'

describe('blob-store', () => {
  it('toBlobRelativePath 应生成嵌套路径', () => {
    expect(toBlobRelativePath('museai/basic-kit', '1.0.0')).toBe('museai/basic-kit/1.0.0.musepack')
  })
})
