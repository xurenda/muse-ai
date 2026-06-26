import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { BASIC_KIT_PACKAGE_ID, type InstalledPackage, type MarketManifest } from '@museai/shared'
import type { MusePaths } from '../paths.js'
import { downloadMusepack, fetchMarketInstallUrl } from './market-backend-client.js'
import { MarketInstallerError } from './market-errors.js'
import { getInstalledPackageVersion, readInstalledPackages, upsertInstalledPackage, writeInstalledPackages } from './installed-store.js'
import { compareSemver } from './compare-semver.js'
import { installMusepackAssets } from './install-musepack-assets.js'
import { backupInstalledAssets, removeInstalledAssets } from './sync-assets.js'
import { findAgentsReferencingPackageAssets } from './uninstall-check.js'
import { unpackMusepackArchive } from './unpack-musepack.js'

export type { SyncBasicKitAction, SyncBasicKitResult } from './basic-kit-sync.js'
export { syncBasicKit } from './basic-kit-sync.js'

export interface InstallMusepackResult {
  packageId: string
  version: string
  action: 'installed' | 'updated'
  assets: InstalledPackage['assets']
}

export interface MarketInstallBackendOptions {
  backendUrl: string
  deviceToken: string
  version?: string
}

async function removePackageBackups(paths: MusePaths, packageId: string): Promise<void> {
  const segments = packageId.split('/')
  const slug = segments.at(-1)
  if (!slug) return
  const parent = join(paths.market, 'backups', ...segments.slice(0, -1))
  let entries: string[] = []
  try {
    entries = await readdir(parent)
  } catch {
    return
  }
  const prefix = `${slug}@`
  await Promise.all(entries.filter(name => name.startsWith(prefix)).map(name => rm(join(parent, name), { recursive: true, force: true })))
}

async function installFromExtractDir(paths: MusePaths, manifest: MarketManifest, extractDir: string): Promise<InstalledPackage['assets']> {
  const assets = await installMusepackAssets(paths, manifest, extractDir)
  const installedAt = new Date().toISOString()
  await upsertInstalledPackage(paths, manifest.id, {
    version: manifest.version,
    installedAt,
    assets,
  })
  return assets
}

/** 从已解压目录安装市场包（更新时会先备份旧版） */
export async function installMarketPackageFromExtract(paths: MusePaths, manifest: MarketManifest, extractDir: string): Promise<InstallMusepackResult> {
  const installed = await readInstalledPackages(paths)
  const previous = installed.packages[manifest.id]
  const action = previous ? 'updated' : 'installed'

  if (previous) {
    await removePackageBackups(paths, manifest.id)
    await backupInstalledAssets(paths, manifest.id, previous.version, previous.assets)
    await removeInstalledAssets(paths, previous.assets)
  }

  const assets = await installFromExtractDir(paths, manifest, extractDir)

  return {
    packageId: manifest.id,
    version: manifest.version,
    action,
    assets,
  }
}

/** 从 .musepack 文件安装（本地调试） */
export async function installMarketPackageFromFile(paths: MusePaths, filePath: string): Promise<InstallMusepackResult> {
  const { readFile } = await import('node:fs/promises')
  const data = new Uint8Array(await readFile(filePath))
  const unpacked = unpackMusepackArchive(data)
  try {
    return await installMarketPackageFromExtract(paths, unpacked.manifest, unpacked.extractDir)
  } finally {
    unpacked.cleanup()
  }
}

/** 从 Backend 下载并安装市场包 */
export async function installMarketPackageFromBackend(
  paths: MusePaths,
  packageId: string,
  options: MarketInstallBackendOptions,
): Promise<InstallMusepackResult> {
  const installUrl = await fetchMarketInstallUrl(options.backendUrl, packageId, options.deviceToken, options.version)
  const data = await downloadMusepack(installUrl.downloadUrl, options.deviceToken, installUrl.sha256)
  const unpacked = unpackMusepackArchive(data, installUrl.sha256)
  try {
    if (unpacked.manifest.id !== packageId) {
      throw new MarketInstallerError('invalid_manifest', `manifest.id (${unpacked.manifest.id}) 与请求包 id 不一致`)
    }
    return await installMarketPackageFromExtract(paths, unpacked.manifest, unpacked.extractDir)
  } finally {
    unpacked.cleanup()
  }
}

/** 更新市场包（等同安装指定或最新 published 版本） */
export async function updateMarketPackage(paths: MusePaths, packageId: string, options: MarketInstallBackendOptions): Promise<InstallMusepackResult> {
  const currentVersion = await getInstalledPackageVersion(paths, packageId)
  if (!currentVersion) {
    throw new MarketInstallerError('package_not_installed', '市场包未安装')
  }

  const result = await installMarketPackageFromBackend(paths, packageId, options)
  if (compareSemver(result.version, currentVersion) <= 0) {
    return { ...result, action: 'updated' }
  }
  return result
}

export async function listInstalledMarketPackages(paths: MusePaths): Promise<ReturnType<typeof readInstalledPackages>> {
  return readInstalledPackages(paths)
}

/** 卸载市场包；若有 Agent 引用则抛错 */
export async function uninstallMarketPackage(paths: MusePaths, packageId: string): Promise<void> {
  if (packageId === BASIC_KIT_PACKAGE_ID) {
    throw new MarketInstallerError('basic_kit_uninstall_forbidden', 'museai/basic-kit 不可卸载')
  }

  const installed = await readInstalledPackages(paths)
  const entry = installed.packages[packageId]
  if (!entry) {
    throw new MarketInstallerError('package_not_installed', '市场包未安装')
  }

  const conflicts = await findAgentsReferencingPackageAssets(paths, entry.assets)
  if (conflicts.length > 0) {
    throw new MarketInstallerError('agents_reference_conflict', '仍有 Agent 引用该套件的 Persona/Skill', {
      conflictingAgents: conflicts,
    })
  }

  await removeInstalledAssets(paths, entry.assets)
  const { [packageId]: _removed, ...rest } = installed.packages
  await writeInstalledPackages(paths, { packages: rest })
}
