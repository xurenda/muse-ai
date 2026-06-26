import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BASIC_KIT_PACKAGE_ID } from '@museai/shared'
import { MarketService } from '@/market/market-service.js'
import { installBlobFile } from '@/market/blob-store.js'

const MANIFEST = {
  id: BASIC_KIT_PACKAGE_ID,
  version: '1.0.0',
  kind: 'kit' as const,
  name: 'MuseAI 基础套件',
  author: 'museai',
  assets: [{ type: 'persona' as const, id: 'museai/basic-kit/general' }],
}

function createSelectChain(rows: unknown[]) {
  return {
    from: () => ({
      innerJoin: () => ({
        where: () => ({
          limit: async () => rows,
        }),
      }),
      where: () => ({
        limit: async () => rows,
      }),
    }),
  }
}

describe('MarketService.createInstallUrl', () => {
  it('应返回 downloadUrl 与 sha256', async () => {
    const marketDataDir = await mkdtemp(join(tmpdir(), 'muse-market-svc-'))
    const sourcePath = join(marketDataDir, 'source.musepack')
    await writeFile(sourcePath, 'zip-content')
    const blobPath = await installBlobFile(marketDataDir, BASIC_KIT_PACKAGE_ID, '1.0.0', sourcePath)

    let versionSelectCount = 0
    const db = {
      select: () => {
        versionSelectCount += 1
        if (versionSelectCount === 1) {
          return createSelectChain([
            {
              pkg: {
                id: BASIC_KIT_PACKAGE_ID,
                status: 'published',
                kind: 'kit',
                name: MANIFEST.name,
                description: null,
                updatedAt: '2026-06-25T00:00:00.000Z',
              },
              author: 'museai',
            },
          ])
        }
        return {
          from: () => ({
            where: async () => [
              {
                version: '1.0.0',
                createdAt: '2026-06-25T00:00:00.000Z',
                manifestJson: JSON.stringify(MANIFEST),
                sha256: 'b'.repeat(64),
                blobPath,
              },
            ],
          }),
        }
      },
    } as unknown as ConstructorParameters<typeof MarketService>[0]

    const service = new MarketService(db, {
      marketDataDir,
      publicBaseUrl: 'http://127.0.0.1:65435',
    })

    const result = await service.createInstallUrl(BASIC_KIT_PACKAGE_ID)
    expect(result).toMatchObject({
      packageId: BASIC_KIT_PACKAGE_ID,
      version: '1.0.0',
      sha256: 'b'.repeat(64),
    })
    expect(result.downloadUrl).toBe('http://127.0.0.1:65435/market/download/museai/basic-kit/1.0.0')
  })
})
