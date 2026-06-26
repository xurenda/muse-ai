import { describe, expect, it } from 'vitest'
import { compareSemver, pickLatestSemver } from '@/utils/compare-semver.js'

describe('compareSemver', () => {
  it('应正确比较版本大小', () => {
    expect(compareSemver('1.0.1', '1.0.0')).toBeGreaterThan(0)
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0)
    expect(compareSemver('0.9.9', '1.0.0')).toBeLessThan(0)
  })
})

describe('pickLatestSemver', () => {
  it('应返回最高版本', () => {
    expect(pickLatestSemver(['1.0.0', '1.2.0', '1.1.0'])).toBe('1.2.0')
  })
})
