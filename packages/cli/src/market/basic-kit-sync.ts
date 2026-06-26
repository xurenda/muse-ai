import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getBasicKitPackageRoot, getBasicKitVersion } from '@museai/basic-kit'
import { BASIC_KIT_PACKAGE_ID, marketManifestSchema } from '@museai/shared'
import type { MusePaths } from '../paths.js'
import { compareSemver } from './compare-semver.js'
import { getInstalledPackageVersion, readInstalledPackages, upsertInstalledPackage } from './installed-store.js'
import { installMusepackAssets } from './install-musepack-assets.js'
import { removeInstalledAssets } from './sync-assets.js'

export type SyncBasicKitAction = 'installed' | 'upgraded' | 'skipped'

export interface SyncBasicKitResult {
  action: SyncBasicKitAction
  packageId: string
  version: string
}

async function loadBasicKitManifest(): Promise<ReturnType<typeof marketManifestSchema.parse>> {
  const packageRoot = getBasicKitPackageRoot()
  const raw = await readFile(join(packageRoot, 'manifest.json'), 'utf8')
  return marketManifestSchema.parse(JSON.parse(raw))
}

/** 从 npm 包内 `@museai/basic-kit` 同步 `museai/basic-kit` 到 ~/.muse/ */
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

  const packageRoot = getBasicKitPackageRoot()
  const assets = await installMusepackAssets(paths, manifest, packageRoot)
  const installedAt = new Date().toISOString()
  await upsertInstalledPackage(paths, BASIC_KIT_PACKAGE_ID, {
    version: npmVersion,
    installedAt,
    assets,
  })

  return {
    action: installedVersion ? 'upgraded' : 'installed',
    packageId: BASIC_KIT_PACKAGE_ID,
    version: npmVersion,
  }
}
