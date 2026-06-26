import { describe, expect, it } from 'vitest'
import { marketPackagePath, parseMarketPackageIdFromSplat } from '@/lib/market-package-path'

describe('market-package-path', () => {
  it('应编码 packageId 为路径', () => {
    expect(marketPackagePath('museai/basic-kit')).toBe('/market/museai/basic-kit')
  })

  it('应从 splat 解析 packageId', () => {
    expect(parseMarketPackageIdFromSplat('museai/basic-kit')).toBe('museai/basic-kit')
    expect(parseMarketPackageIdFromSplat('installed')).toBeNull()
    expect(parseMarketPackageIdFromSplat(undefined)).toBeNull()
  })
})
