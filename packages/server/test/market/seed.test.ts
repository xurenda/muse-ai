import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getBasicKitPackageRoot, packMusepack } from '@museai/basic-kit'
import { BASIC_KIT_PACKAGE_ID, marketManifestSchema } from '@museai/shared'

/** Server 启动时 seedMarketData → ensureBasicKitPackage 依赖 packMusepack */
describe('seedMarketData musepack 构建', () => {
  it('应能从 @museai/basic-kit 源码构建合法 .musepack', () => {
    const packageRoot = getBasicKitPackageRoot()
    const manifest = marketManifestSchema.parse(JSON.parse(readFileSync(join(packageRoot, 'manifest.json'), 'utf8')) as unknown)

    expect(manifest.id).toBe(BASIC_KIT_PACKAGE_ID)

    const packed = packMusepack({ packageRoot })
    expect(packed.packageId).toBe(BASIC_KIT_PACKAGE_ID)
    expect(packed.version).toBe(manifest.version)
    expect(packed.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(packed.sizeBytes).toBeGreaterThan(0)
  })
})
