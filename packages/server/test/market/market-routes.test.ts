import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { BASIC_KIT_PACKAGE_ID, marketDownloadPath, marketPackageInstallUrlPath } from '@museai/shared'
import { createServerApp, type ServerContext } from '@/app.js'
import { loadServerConfig } from '@/config.js'

const TEST_ENV = {
  JWT_SECRET: 'test-jwt-secret',
  ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
}

const INSTALL_URL_RESPONSE = {
  packageId: BASIC_KIT_PACKAGE_ID,
  version: '1.0.0',
  sha256: 'a'.repeat(64),
  downloadUrl: `http://127.0.0.1:65435${marketDownloadPath(BASIC_KIT_PACKAGE_ID, '1.0.0')}`,
}

function createMarketMockContext(): ServerContext {
  return {
    config: loadServerConfig(TEST_ENV),
    authService: {
      register: vi.fn(),
      login: vi.fn(),
      verifyAccessToken: vi.fn().mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        email: 'dev@muse.ai',
        username: 'kingen',
      }),
      refreshAccessToken: vi.fn(),
    },
    settingsService: {} as ServerContext['settingsService'],
    providerResolver: {} as ServerContext['providerResolver'],
    deviceService: {
      authenticateDeviceToken: vi.fn().mockResolvedValue({
        deviceId: 'device-1',
        userId: '550e8400-e29b-41d4-a716-446655440001',
      }),
    } as ServerContext['deviceService'],
    llmProxyService: {} as ServerContext['llmProxyService'],
    llmProxyOrchestrator: {} as ServerContext['llmProxyOrchestrator'],
    marketService: {
      listPublishedPackages: vi.fn().mockResolvedValue({
        packages: [
          {
            id: BASIC_KIT_PACKAGE_ID,
            kind: 'kit',
            name: 'MuseAI 基础套件',
            author: 'museai',
            status: 'published',
            latestVersion: '1.0.0',
            updatedAt: '2026-06-25T00:00:00.000Z',
          },
        ],
      }),
      getPackageDetail: vi.fn().mockResolvedValue({
        id: BASIC_KIT_PACKAGE_ID,
        kind: 'kit',
        name: 'MuseAI 基础套件',
        author: 'museai',
        status: 'published',
        latestVersion: '1.0.0',
        updatedAt: '2026-06-25T00:00:00.000Z',
        versions: [{ version: '1.0.0', createdAt: '2026-06-25T00:00:00.000Z' }],
        manifest: {
          id: BASIC_KIT_PACKAGE_ID,
          version: '1.0.0',
          kind: 'kit',
          name: 'MuseAI 基础套件',
          author: 'museai',
          assets: [],
        },
      }),
      createInstallUrl: vi.fn().mockResolvedValue(INSTALL_URL_RESPONSE),
      getPublishedVersionBlob: vi.fn().mockResolvedValue({
        absolutePath: '/tmp/test.musepack',
        sha256: INSTALL_URL_RESPONSE.sha256,
      }),
    },
    close: async () => {},
  }
}

describe('market routes', () => {
  it('未登录访问市场列表应返回 401', async () => {
    const app = createServerApp(createMarketMockContext())
    const res = await app.request('http://localhost/market/packages')
    expect(res.status).toBe(401)
  })

  it('已登录应返回市场列表', async () => {
    const app = createServerApp(createMarketMockContext())
    const res = await app.request('http://localhost/market/packages', {
      headers: { Authorization: 'Bearer test-token' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.packages).toHaveLength(1)
    expect(body.packages[0].id).toBe(BASIC_KIT_PACKAGE_ID)
  })

  it('已登录应返回市场包详情', async () => {
    const app = createServerApp(createMarketMockContext())
    const res = await app.request(`http://localhost/market/packages/${BASIC_KIT_PACKAGE_ID}`, {
      headers: { Authorization: 'Bearer test-token' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(BASIC_KIT_PACKAGE_ID)
    expect(body.versions).toHaveLength(1)
  })

  it('已登录应获取 install-url', async () => {
    const ctx = createMarketMockContext()
    const app = createServerApp(ctx)
    const res = await app.request(`http://localhost${marketPackageInstallUrlPath(BASIC_KIT_PACKAGE_ID)}`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      packageId: BASIC_KIT_PACKAGE_ID,
      version: '1.0.0',
      sha256: INSTALL_URL_RESPONSE.sha256,
    })
    expect(body.downloadUrl).toContain('/market/download/museai/basic-kit/1.0.0')
    expect(ctx.marketService.createInstallUrl).toHaveBeenCalledWith(BASIC_KIT_PACKAGE_ID, undefined)
  })

  it('device token 也应获取 install-url', async () => {
    const ctx = createMarketMockContext()
    vi.mocked(ctx.authService.verifyAccessToken).mockRejectedValue(new Error('invalid'))
    const app = createServerApp(ctx)
    const res = await app.request(`http://localhost${marketPackageInstallUrlPath(BASIC_KIT_PACKAGE_ID)}`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer device-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(200)
    expect(ctx.deviceService.authenticateDeviceToken).toHaveBeenCalledWith('device-token')
  })

  it('无 device token 下载应返回 401', async () => {
    const app = createServerApp(createMarketMockContext())
    const res = await app.request(`http://localhost${marketDownloadPath(BASIC_KIT_PACKAGE_ID, '1.0.0')}`)
    expect(res.status).toBe(401)
  })

  it('有 device token 应可下载包', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'muse-market-'))
    const filePath = join(tempDir, 'kit.musepack')
    await writeFile(filePath, 'musepack-binary')

    const ctx = createMarketMockContext()
    ctx.marketService.getPublishedVersionBlob = vi.fn().mockResolvedValue({
      absolutePath: filePath,
      sha256: INSTALL_URL_RESPONSE.sha256,
    })
    const app = createServerApp(ctx)

    const res = await app.request(`http://localhost${marketDownloadPath(BASIC_KIT_PACKAGE_ID, '1.0.0')}`, {
      headers: { Authorization: 'Bearer device-token' },
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('x-muse-pack-sha256')).toBe(INSTALL_URL_RESPONSE.sha256)
    expect(await res.text()).toBe('musepack-binary')
    expect(ctx.marketService.getPublishedVersionBlob).toHaveBeenCalledWith(BASIC_KIT_PACKAGE_ID, '1.0.0')
  })
})
