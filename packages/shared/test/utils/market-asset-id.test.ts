import { describe, expect, it } from 'vitest'
import { BASIC_KIT_PACKAGE_ID } from '@/constants/market.js'
import { basicKitAssetId, scopeAssetId } from '@/utils/market-asset-id.js'

describe('scopeAssetId', () => {
  it('应将 slug 补全为 scoped id', () => {
    expect(scopeAssetId(BASIC_KIT_PACKAGE_ID, 'general')).toBe('museai/basic-kit/general')
  })
})

describe('basicKitAssetId', () => {
  it('应生成 basic-kit scoped 资产 id', () => {
    expect(basicKitAssetId('git')).toBe('museai/basic-kit/git')
  })
})
