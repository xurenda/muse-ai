import { cp, mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { MarketAsset } from '@museai/shared'
import type { MusePaths } from '../paths.js'

function assertSafeAssetId(id: string): void {
  const segments = id.split('/')
  if (segments.length === 0 || segments.some(segment => segment === '' || segment === '.' || segment === '..')) {
    throw new Error(`非法资产 id: ${id}`)
  }
}

function resolveAssetPath(paths: MusePaths, asset: MarketAsset): string {
  assertSafeAssetId(asset.id)
  switch (asset.type) {
    case 'agent':
      return join(paths.agents, asset.id)
    case 'persona':
      return join(paths.personas, ...asset.id.split('/'))
    case 'skill':
      return join(paths.skills, ...asset.id.split('/'))
  }
}

export async function removeInstalledAssets(paths: MusePaths, assets: MarketAsset[]): Promise<void> {
  for (const asset of assets) {
    await rm(resolveAssetPath(paths, asset), { recursive: true, force: true })
  }
}

export async function backupInstalledAssets(paths: MusePaths, packageId: string, version: string, assets: MarketAsset[]): Promise<string> {
  const backupKey = `${packageId}@${version}`
  const backupDir = join(paths.market, 'backups', ...backupKey.split('/'))
  await mkdir(backupDir, { recursive: true })
  for (const asset of assets) {
    const src = resolveAssetPath(paths, asset)
    const relative = asset.type === 'agent' ? join('agents', asset.id) : join(asset.type === 'persona' ? 'personas' : 'skills', ...asset.id.split('/'))
    const dest = join(backupDir, relative)
    await mkdir(dirname(dest), { recursive: true })
    await cp(src, dest, { recursive: true }).catch(() => undefined)
  }
  return backupDir
}
