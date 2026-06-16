import { describe, expect, it } from 'vitest'
import { applyEditsToNormalizedContent, fuzzyFindText } from '@/tools/edit-diff.js'

describe('edit-diff', () => {
  it('fuzzyFindText 精确匹配', () => {
    const result = fuzzyFindText('hello world', 'world')
    expect(result.found).toBe(true)
    expect(result.index).toBe(6)
    expect(result.usedFuzzyMatch).toBe(false)
  })

  it('applyEditsToNormalizedContent 单次替换', () => {
    const { newContent } = applyEditsToNormalizedContent('alpha\nbeta\ngamma\n', [{ oldText: 'beta', newText: 'BETA' }], 'f.ts')
    expect(newContent).toBe('alpha\nBETA\ngamma\n')
  })

  it('重叠 edits 抛错', () => {
    expect(() =>
      applyEditsToNormalizedContent(
        'abcdef',
        [
          { oldText: 'abc', newText: '1' },
          { oldText: 'bcd', newText: '2' },
        ],
        'f.ts',
      ),
    ).toThrow(/overlap/)
  })

  it('重复 oldText 抛错', () => {
    expect(() => applyEditsToNormalizedContent('foo foo', [{ oldText: 'foo', newText: 'bar' }], 'f.ts')).toThrow(/occurrences/)
  })
})
