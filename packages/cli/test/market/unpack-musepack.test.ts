import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { zipSync } from 'fflate'
import { MUSEPACK_MAX_BYTES } from '@museai/shared'
import { MarketInstallerError } from '@/market/market-errors.js'
import { unpackMusepackArchive } from '@/market/unpack-musepack.js'

const VALID_MANIFEST = {
  id: 'museai/basic-kit',
  version: '1.0.0',
  kind: 'kit',
  name: '测试套件',
  author: 'museai',
  assets: [{ type: 'persona', id: 'museai/basic-kit/general' }],
}

function buildZip(files: Record<string, string>): Uint8Array {
  const zipped: Record<string, Uint8Array> = {}
  for (const [name, content] of Object.entries(files)) {
    zipped[name] = new TextEncoder().encode(content)
  }
  return zipSync(zipped)
}

describe('unpackMusepackArchive', () => {
  it('应解压合法 musepack', () => {
    const data = buildZip({
      'manifest.json': JSON.stringify(VALID_MANIFEST),
      'personas/museai/basic-kit/general/persona.json': JSON.stringify({ id: 'museai/basic-kit/general', name: '通用' }),
    })
    const result = unpackMusepackArchive(data)
    try {
      expect(result.manifest.id).toBe('museai/basic-kit')
      expect(readFileSync(join(result.extractDir, 'manifest.json'), 'utf8')).toContain('museai/basic-kit')
    } finally {
      result.cleanup()
    }
  })

  it('应拒绝路径穿越', () => {
    const data = buildZip({
      'manifest.json': JSON.stringify(VALID_MANIFEST),
      '../escape.txt': 'bad',
    })
    expect(() => unpackMusepackArchive(data)).toThrow(MarketInstallerError)
  })

  it('应拒绝超大包', () => {
    const huge = new Uint8Array(MUSEPACK_MAX_BYTES + 1)
    expect(() => unpackMusepackArchive(huge)).toThrow(MarketInstallerError)
  })

  it('应校验 sha256', () => {
    const data = buildZip({
      'manifest.json': JSON.stringify(VALID_MANIFEST),
    })
    expect(() => unpackMusepackArchive(data, 'deadbeef'.repeat(8))).toThrow(MarketInstallerError)
  })
})

describe('installMarketPackageFromFile', () => {
  it('应从本地 .musepack 安装', async () => {
    const { packMusepack } = await import('@museai/basic-kit')
    const packageRoot = join(import.meta.dirname, '../../../basic-kit')
    const outputDir = mkdtempSync(join(tmpdir(), 'muse-install-'))
    try {
      const packed = packMusepack({ packageRoot, outputDir })
      const { mkdtemp, readFile } = await import('node:fs/promises')
      const { ensureMuseDir, getMusePaths } = await import('@/paths.js')
      const { installMarketPackageFromFile } = await import('@/market/market-installer.js')
      const { readInstalledPackages } = await import('@/market/installed-store.js')

      const tempHome = await mkdtemp(join(tmpdir(), 'muse-home-'))
      process.env.MUSE_HOME = tempHome
      const paths = getMusePaths()
      await ensureMuseDir(paths)

      const result = await installMarketPackageFromFile(paths, packed.outputPath)
      expect(result.packageId).toBe('museai/basic-kit')
      expect(result.action).toBe('installed')

      const installed = await readInstalledPackages(paths)
      expect(installed.packages['museai/basic-kit']?.version).toBe('1.0.0')
      const origin = JSON.parse(await readFile(join(paths.personas, 'museai/basic-kit/general/.muse-origin.json'), 'utf8')) as {
        packageId: string
      }
      expect(origin.packageId).toBe('museai/basic-kit')
    } finally {
      delete process.env.MUSE_HOME
      rmSync(outputDir, { recursive: true, force: true })
    }
  })
})

describe('uninstallMarketPackage', () => {
  it('应拒绝卸载 basic-kit', async () => {
    const { uninstallMarketPackage } = await import('@/market/market-installer.js')
    const { getMusePaths } = await import('@/paths.js')
    await expect(uninstallMarketPackage(getMusePaths(), 'museai/basic-kit')).rejects.toMatchObject({
      code: 'basic_kit_uninstall_forbidden',
    })
  })
})
