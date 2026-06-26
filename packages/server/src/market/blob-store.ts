import { access, copyFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/** 相对 marketDataDir 的 blob 路径，如 `museai/basic-kit/1.0.0.musepack` */
export function toBlobRelativePath(packageId: string, version: string): string {
  return join(packageId, `${version}.musepack`)
}

export function resolveBlobAbsolutePath(marketDataDir: string, blobPath: string): string {
  return join(marketDataDir, blobPath)
}

/** 将已生成的 .musepack 写入市场 blob 目录 */
export async function installBlobFile(marketDataDir: string, packageId: string, version: string, sourcePath: string): Promise<string> {
  const blobPath = toBlobRelativePath(packageId, version)
  const dest = resolveBlobAbsolutePath(marketDataDir, blobPath)
  await mkdir(dirname(dest), { recursive: true })
  await copyFile(sourcePath, dest)
  return blobPath
}

export async function assertBlobExists(marketDataDir: string, blobPath: string): Promise<string> {
  const absolutePath = resolveBlobAbsolutePath(marketDataDir, blobPath)
  await access(absolutePath)
  return absolutePath
}
