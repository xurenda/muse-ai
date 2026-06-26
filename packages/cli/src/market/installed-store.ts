import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { installedPackagesFileSchema, type InstalledPackage, type MarketAsset } from '@museai/shared'
import type { MusePaths } from '../paths.js'

export function getInstalledPackagesPath(paths: MusePaths): string {
  return join(paths.market, 'installed.json')
}

export async function readInstalledPackages(paths: MusePaths): Promise<ReturnType<typeof installedPackagesFileSchema.parse>> {
  const filePath = getInstalledPackagesPath(paths)
  try {
    const raw = await readFile(filePath, 'utf8')
    return installedPackagesFileSchema.parse(JSON.parse(raw))
  } catch {
    return { packages: {} }
  }
}

export async function writeInstalledPackages(paths: MusePaths, data: ReturnType<typeof installedPackagesFileSchema.parse>): Promise<void> {
  await mkdir(paths.market, { recursive: true })
  await writeFile(getInstalledPackagesPath(paths), `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

export async function getInstalledPackageVersion(paths: MusePaths, packageId: string): Promise<string | undefined> {
  const installed = await readInstalledPackages(paths)
  return installed.packages[packageId]?.version
}

export async function upsertInstalledPackage(paths: MusePaths, packageId: string, entry: InstalledPackage): Promise<void> {
  const installed = await readInstalledPackages(paths)
  installed.packages[packageId] = entry
  await writeInstalledPackages(paths, installed)
}

export type { MarketAsset }
