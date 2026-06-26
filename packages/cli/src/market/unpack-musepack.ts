import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, posix } from 'node:path'
import { MUSEPACK_MAX_BYTES, marketManifestSchema, type MarketManifest } from '@museai/shared'
import { unzipSync } from 'fflate'
import { MarketInstallerError } from './market-errors.js'

export interface UnpackMusepackResult {
  manifest: MarketManifest
  extractDir: string
  sha256: string
  cleanup: () => void
}

export function computeMusepackSha256(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex')
}

function assertSafeZipEntryPath(entryPath: string): void {
  if (entryPath.startsWith('/') || entryPath.includes('\\')) {
    throw new MarketInstallerError('unsafe_zip_path', `非法 zip 路径: ${entryPath}`)
  }
  const normalized = posix.normalize(entryPath)
  if (normalized.startsWith('../') || normalized.includes('/../') || normalized === '..') {
    throw new MarketInstallerError('unsafe_zip_path', `非法 zip 路径: ${entryPath}`)
  }
}

/** 解压 .musepack（zip），校验体积、路径安全与 manifest */
export function unpackMusepackArchive(data: Uint8Array, expectedSha256?: string): UnpackMusepackResult {
  if (data.byteLength > MUSEPACK_MAX_BYTES) {
    throw new MarketInstallerError('pack_too_large', `包体积超过 ${MUSEPACK_MAX_BYTES} 字节`)
  }

  const sha256 = computeMusepackSha256(data)
  if (expectedSha256 && sha256 !== expectedSha256.toLowerCase()) {
    throw new MarketInstallerError('sha256_mismatch', '包 sha256 校验失败')
  }

  const entries = unzipSync(data)
  let unpackedBytes = 0
  for (const [entryPath, content] of Object.entries(entries)) {
    assertSafeZipEntryPath(entryPath)
    if (entryPath.endsWith('/')) continue
    unpackedBytes += content.byteLength
    if (unpackedBytes > MUSEPACK_MAX_BYTES) {
      throw new MarketInstallerError('pack_too_large', `解压后体积超过 ${MUSEPACK_MAX_BYTES} 字节`)
    }
  }

  const manifestBytes = entries['manifest.json']
  if (!manifestBytes) {
    throw new MarketInstallerError('invalid_manifest', '包内缺少 manifest.json')
  }

  let manifest: MarketManifest
  try {
    manifest = marketManifestSchema.parse(JSON.parse(new TextDecoder().decode(manifestBytes)) as unknown)
  } catch {
    throw new MarketInstallerError('invalid_manifest', 'manifest.json 校验失败')
  }

  const extractDir = mkdtempSync(join(tmpdir(), 'muse-unpack-'))
  try {
    for (const [entryPath, content] of Object.entries(entries)) {
      if (entryPath.endsWith('/')) continue
      assertSafeZipEntryPath(entryPath)
      const dest = join(extractDir, entryPath)
      mkdirSync(dirname(dest), { recursive: true })
      writeFileSync(dest, content)
    }
  } catch (error: unknown) {
    rmSync(extractDir, { recursive: true, force: true })
    throw error
  }

  return {
    manifest,
    extractDir,
    sha256,
    cleanup: () => {
      rmSync(extractDir, { recursive: true, force: true })
    },
  }
}
