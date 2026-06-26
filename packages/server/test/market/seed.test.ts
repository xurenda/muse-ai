import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getBasicKitMusepackPath, getBasicKitPackageRoot } from '@museai/basic-kit'
import { BASIC_KIT_PACKAGE_ID, marketManifestSchema } from '@museai/shared'

/** Server 启动种子依赖 CI / 本地构建的 basic-kit .musepack */
describe('seedMarketData musepack 产物', () => {
  it('应存在与 manifest 版本一致的预构建 .musepack', () => {
    const packageRoot = getBasicKitPackageRoot()
    const manifest = marketManifestSchema.parse(JSON.parse(readFileSync(join(packageRoot, 'manifest.json'), 'utf8')) as unknown)

    expect(manifest.id).toBe(BASIC_KIT_PACKAGE_ID)

    const musepackPath = getBasicKitMusepackPath()
    expect(existsSync(musepackPath)).toBe(true)
    expect(musepackPath).toContain(`museai-basic-kit-${manifest.version}.musepack`)
  })
})
