import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_PORTS } from '@museai/shared'
import { loadServerConfig } from '@/config.js'
import { createServerApp, type ServerContext } from '@/app.js'
import { AuthError } from '@/services/auth-service.js'

const TEST_ENV = {
  JWT_SECRET: 'test-jwt-secret',
  ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
}

function createMockContext(): ServerContext {
  return {
    config: loadServerConfig(TEST_ENV),
    authService: {
      register: vi.fn(),
      login: vi.fn().mockResolvedValue({
        accessToken: 'jwt-token',
        user: { id: '550e8400-e29b-41d4-a716-446655440001', email: 'dev@muse.ai' },
      }),
      verifyAccessToken: vi.fn(),
    },
    settingsService: {
      getModelsConfig: vi.fn(),
      updateModelsConfig: vi.fn(),
      getModelStrategy: vi.fn(),
      updateModelStrategy: vi.fn(),
      getProvidersConfig: vi.fn(),
      saveProviderApiKey: vi.fn(),
      deleteProviderApiKey: vi.fn(),
      saveBuiltinProviderAdvanced: vi.fn(),
      saveCustomProvider: vi.fn(),
      deleteCustomProvider: vi.fn(),
    },
    providerResolver: {
      resolve: vi.fn(),
    },
    deviceService: {
      createPairCode: vi.fn(),
      pair: vi.fn(),
      listForUser: vi.fn().mockResolvedValue([]),
      heartbeat: vi.fn(),
      authenticateDeviceToken: vi.fn(),
    },
    llmProxyService: {
      forward: vi.fn(),
    },
    llmProxyOrchestrator: {
      handle: vi.fn(),
    },
    marketService: {
      listPublishedPackages: vi.fn().mockResolvedValue({ packages: [] }),
      getPackageDetail: vi.fn(),
    },
    close: async () => {},
  }
}

describe('loadServerConfig', () => {
  it('应使用默认端口 65435', () => {
    const config = loadServerConfig(TEST_ENV)
    expect(config.port).toBe(DEFAULT_PORTS.SERVER)
    expect(config.databaseUrl).toContain('postgresql://')
  })

  it('缺少 JWT_SECRET 时应抛错', () => {
    expect(() => loadServerConfig({ ENCRYPTION_KEY: TEST_ENV.ENCRYPTION_KEY })).toThrow('JWT_SECRET')
  })

  it('应默认允许 Web dev 来源 CORS', () => {
    const config = loadServerConfig(TEST_ENV)
    expect(config.corsOrigins).toContain(`http://localhost:${DEFAULT_PORTS.WEB_DEV}`)
    expect(config.corsOrigins).toContain(`http://127.0.0.1:${DEFAULT_PORTS.WEB_DEV}`)
  })
})

describe('createServerApp', () => {
  it('GET /health 应返回 ok', async () => {
    const app = createServerApp(createMockContext())
    const res = await app.request('http://localhost/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ ok: true, service: 'server' })
  })

  it('POST /auth/login 合法请求应返回 token', async () => {
    const app = createServerApp(createMockContext())
    const res = await app.request('http://localhost/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dev@muse.ai', password: 'password123' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.accessToken).toBe('jwt-token')
  })

  it('POST /auth/login 非法请求应返回 400', async () => {
    const app = createServerApp(createMockContext())
    const res = await app.request('http://localhost/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bad', password: 'short' }),
    })
    expect(res.status).toBe(400)
  })

  it('POST /auth/register 保留用户名应返回 409 username_taken', async () => {
    const app = createServerApp(createMockContext())
    const res = await app.request('http://localhost/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'password123', username: 'museai' }),
    })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body).toMatchObject({ error: 'username_taken' })
  })

  it('POST /auth/register 缺少 username 应返回 400', async () => {
    const app = createServerApp(createMockContext())
    const res = await app.request('http://localhost/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'password123' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('invalid_request')
  })

  it('POST /auth/register 用户名冲突应返回 409', async () => {
    const ctx = createMockContext()
    ctx.authService.register = vi.fn().mockRejectedValue(new AuthError('username_taken', '用户名已存在'))
    const app = createServerApp(ctx)
    const res = await app.request('http://localhost/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'password123', username: 'kingen' }),
    })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body).toMatchObject({ error: 'username_taken' })
  })

  it('OPTIONS 预检应返回 CORS 头', async () => {
    const app = createServerApp(createMockContext())
    const res = await app.request('http://localhost/auth/register', {
      method: 'OPTIONS',
      headers: {
        Origin: `http://localhost:${DEFAULT_PORTS.WEB_DEV}`,
        'Access-Control-Request-Method': 'POST',
      },
    })
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe(`http://localhost:${DEFAULT_PORTS.WEB_DEV}`)
  })
})
