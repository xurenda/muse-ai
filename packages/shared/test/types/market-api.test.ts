import { describe, expect, it } from 'vitest'
import { marketDownloadPath, marketPackageInstallUrlPath } from '@/types/market-api.js'

describe('market API paths', () => {
  it('应构建 install-url 与 download 路径', () => {
    expect(marketPackageInstallUrlPath('museai/basic-kit')).toBe('/market/packages/museai/basic-kit/install-url')
    expect(marketDownloadPath('museai/basic-kit', '1.0.0')).toBe('/market/download/museai/basic-kit/1.0.0')
  })
})
