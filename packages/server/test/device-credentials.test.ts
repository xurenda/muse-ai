import { describe, expect, it, vi } from 'vitest'
import { deviceCredentialsPath, DEFAULT_PORTS } from '@muse-ai/shared'
import { loadServerConfig } from '@/config.js'
import { createServerApp, type ServerContext } from '@/app.js'

const TEST_ENV = {
  JWT_SECRET: 'test-jwt-secret',
  ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
}

const USER_ID = '550e8400-e29b-41d4-a716-446655440001'
const DEVICE_ID = '660e8400-e29b-41d4-a716-446655440002'

function createMockContext(overrides?: Partial<ServerContext>): ServerContext {
  return {
    config: loadServerConfig(TEST_ENV),
    authService: {
      register: vi.fn(),
      login: vi.fn().mockResolvedValue({
        accessToken: 'jwt-token',
        user: { id: USER_ID, email: 'dev@muse.ai' },
      }),
      verifyAccessToken: vi.fn().mockResolvedValue({ id: USER_ID, email: 'dev@muse.ai' }),
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
      getCredentialsForUser: vi.fn().mockResolvedValue({
        deviceId: DEVICE_ID,
        endpoint: `http://127.0.0.1:${DEFAULT_PORTS.CLI}`,
        accessToken: 'device-token',
      }),
      heartbeat: vi.fn(),
      authenticateDeviceToken: vi.fn(),
    },
    llmProxyService: {
      forward: vi.fn(),
    },
    close: async () => {},
    ...overrides,
  }
}

describe('device credentials', () => {
  it('GET /devices/:id/credentials 应返回 endpoint 与 accessToken', async () => {
    const ctx = createMockContext()
    const app = createServerApp(ctx)
    const res = await app.request(`http://localhost${deviceCredentialsPath(DEVICE_ID)}`, {
      headers: { Authorization: 'Bearer jwt-token' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      deviceId: DEVICE_ID,
      endpoint: `http://127.0.0.1:${DEFAULT_PORTS.CLI}`,
      accessToken: 'device-token',
    })
    expect(ctx.deviceService.getCredentialsForUser).toHaveBeenCalledWith(USER_ID, DEVICE_ID)
  })

  it('未授权时应返回 401', async () => {
    const app = createServerApp(createMockContext())
    const res = await app.request(`http://localhost${deviceCredentialsPath(DEVICE_ID)}`)
    expect(res.status).toBe(401)
  })
})
