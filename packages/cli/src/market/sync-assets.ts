import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { getBasicKitAssetsRoot } from '@museai/basic-kit'
import { museOriginSchema, type MarketAsset, type MarketManifest } from '@museai/shared'
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

async function copyDirContents(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true })
  const entries = await readdir(src, { withFileTypes: true })
  await Promise.all(entries.map(entry => cp(join(src, entry.name), join(dest, entry.name), { recursive: true })))
}

/** 将 basic-kit `assets/` 下某类目录同步到 ~/.muse/ 对应根目录 */
export async function copyAssetKind(paths: MusePaths, kind: 'personas' | 'skills' | 'agents', sourceAssetsRoot: string): Promise<void> {
  const src = join(sourceAssetsRoot, kind)
  const dest = paths[kind]
  await mkdir(dest, { recursive: true })
  await copyDirContents(src, dest)
}

export async function removeInstalledAssets(paths: MusePaths, assets: MarketAsset[]): Promise<void> {
  for (const asset of assets) {
    await rm(resolveAssetPath(paths, asset), { recursive: true, force: true })
  }
}

export async function writeMuseOriginFiles(paths: MusePaths, manifest: MarketManifest, installedAt: string): Promise<void> {
  for (const asset of manifest.assets) {
    if (asset.type === 'agent') continue
    const dir = resolveAssetPath(paths, asset)
    const origin = museOriginSchema.parse({
      packageId: manifest.id,
      packageVersion: manifest.version,
      installedAt,
    })
    await writeFile(join(dir, '.muse-origin.json'), `${JSON.stringify(origin, null, 2)}\n`, 'utf8')
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

export function getBundledAssetsRoot(): string {
  return getBasicKitAssetsRoot()
}
