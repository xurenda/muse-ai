import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { getBasicKitAssetsRoot, getBasicKitVersion } from '@museai/basic-kit'
import { BASIC_KIT_PACKAGE_ID, marketManifestSchema } from '@museai/shared'
import type { MusePaths } from '../paths.js'
import { compareSemver } from './compare-semver.js'
import { getInstalledPackageVersion, readInstalledPackages, upsertInstalledPackage } from './installed-store.js'
import { copyAssetKind, getBundledAssetsRoot, removeInstalledAssets, writeMuseOriginFiles } from './sync-assets.js'

export type SyncBasicKitAction = 'installed' | 'upgraded' | 'skipped'

export interface SyncBasicKitResult {
  action: SyncBasicKitAction
  packageId: string
  version: string
}

async function loadBasicKitManifest(): Promise<ReturnType<typeof marketManifestSchema.parse>> {
  const assetsRoot = getBasicKitAssetsRoot()
  const manifestPath = join(dirname(assetsRoot), 'manifest.json')
  const raw = await readFile(manifestPath, 'utf8')
  return marketManifestSchema.parse(JSON.parse(raw))
}

/** 从 npm 包内 `@museai/basic-kit` assets 同步 `museai/basic-kit` 到 ~/.muse/ */
export async function syncBasicKit(paths: MusePaths): Promise<SyncBasicKitResult> {
  const manifest = await loadBasicKitManifest()
  const npmVersion = getBasicKitVersion()
  if (manifest.version !== npmVersion) {
    throw new Error(`basic-kit manifest.version (${manifest.version}) 与 package.json (${npmVersion}) 不一致`)
  }
  if (manifest.id !== BASIC_KIT_PACKAGE_ID) {
    throw new Error(`basic-kit manifest.id 应为 ${BASIC_KIT_PACKAGE_ID}`)
  }

  const installedVersion = await getInstalledPackageVersion(paths, BASIC_KIT_PACKAGE_ID)
  if (installedVersion && compareSemver(npmVersion, installedVersion) <= 0) {
    return { action: 'skipped', packageId: BASIC_KIT_PACKAGE_ID, version: installedVersion }
  }

  const installed = await readInstalledPackages(paths)
  const previous = installed.packages[BASIC_KIT_PACKAGE_ID]
  if (previous) {
    await removeInstalledAssets(paths, previous.assets)
  }

  const sourceRoot = getBundledAssetsRoot()
  await copyAssetKind(paths, 'personas', sourceRoot)
  await copyAssetKind(paths, 'skills', sourceRoot)
  await copyAssetKind(paths, 'agents', sourceRoot)

  const installedAt = new Date().toISOString()
  await writeMuseOriginFiles(paths, manifest, installedAt)
  await upsertInstalledPackage(paths, BASIC_KIT_PACKAGE_ID, {
    version: npmVersion,
    installedAt,
    assets: manifest.assets,
  })

  return {
    action: installedVersion ? 'upgraded' : 'installed',
    packageId: BASIC_KIT_PACKAGE_ID,
    version: npmVersion,
  }
}
