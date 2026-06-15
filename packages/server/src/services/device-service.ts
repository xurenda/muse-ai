import { randomInt } from 'node:crypto'
import { desc, eq } from 'drizzle-orm'
import type { Redis } from 'ioredis'
import type { Device, DeviceHeartbeatRequest, DevicePairRequest, DevicePairResponse, PairInitResponse } from '@muse-ai/shared'
import { deviceSchema } from '@muse-ai/shared'
import { AuthError, generateDeviceToken, hashDeviceToken, safeEqualString, verifyDeviceToken } from './auth-service.js'
import type { MuseDb } from '../db/client.js'
import { devices } from '../db/schema.js'
import { DEVICE_ONLINE_PREFIX, DEVICE_ONLINE_TTL_SECONDS, PAIR_CODE_PREFIX, PAIR_CODE_TTL_SECONDS } from '../redis/client.js'

const PAIR_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generatePairCode(length = 6): string {
  let code = ''
  for (let i = 0; i < length; i += 1) {
    code += PAIR_ALPHABET[randomInt(PAIR_ALPHABET.length)]
  }
  return code
}

function toDevice(row: typeof devices.$inferSelect, online: boolean): Device {
  return deviceSchema.parse({
    id: row.id,
    name: row.name,
    endpoint: row.endpoint ?? undefined,
    online,
    lastSeenAt: row.lastSeenAt ? new Date(row.lastSeenAt).toISOString() : undefined,
  })
}

export class DeviceService {
  constructor(
    private readonly db: MuseDb,
    private readonly redis: Redis,
  ) {}

  async createPairCode(userId: string): Promise<PairInitResponse> {
    const pairCode = generatePairCode()
    const expiresAt = new Date(Date.now() + PAIR_CODE_TTL_SECONDS * 1000).toISOString()
    await this.redis.set(`${PAIR_CODE_PREFIX}${pairCode}`, userId, 'EX', PAIR_CODE_TTL_SECONDS)
    return { pairCode, expiresAt }
  }

  async pair(request: DevicePairRequest): Promise<DevicePairResponse> {
    const userId = await this.redis.get(`${PAIR_CODE_PREFIX}${request.pairCode}`)
    if (!userId) {
      throw new DeviceError('invalid_pair_code', '配对码无效或已过期')
    }

    const accessToken = generateDeviceToken()
    const accessTokenHash = await hashDeviceToken(accessToken)
    const [row] = await this.db
      .insert(devices)
      .values({
        userId,
        name: request.name,
        accessTokenHash,
        endpoint: request.endpoint,
        lastSeenAt: new Date().toISOString(),
      })
      .returning()

    if (!row) {
      throw new DeviceError('pair_failed', '设备注册失败')
    }

    await this.redis.del(`${PAIR_CODE_PREFIX}${request.pairCode}`)
    await this.markOnline(row.id, request.endpoint)

    return {
      device: toDevice(row, true),
      accessToken,
    }
  }

  async listForUser(userId: string): Promise<Device[]> {
    const rows = await this.db.select().from(devices).where(eq(devices.userId, userId)).orderBy(desc(devices.createdAt))
    const result: Device[] = []
    for (const row of rows) {
      const online = Boolean(await this.redis.get(`${DEVICE_ONLINE_PREFIX}${row.id}`))
      result.push(toDevice(row, online))
    }
    return result
  }

  async heartbeat(deviceId: string, body: DeviceHeartbeatRequest): Promise<Device> {
    const [row] = await this.db.select().from(devices).where(eq(devices.id, deviceId)).limit(1)
    if (!row) {
      throw new DeviceError('device_not_found', '设备不存在')
    }

    const now = new Date().toISOString()
    const endpoint = body.endpoint ?? row.endpoint ?? undefined
    const [updated] = await this.db
      .update(devices)
      .set({
        endpoint: endpoint ?? null,
        lastSeenAt: now,
      })
      .where(eq(devices.id, deviceId))
      .returning()

    if (!updated) {
      throw new DeviceError('device_not_found', '设备不存在')
    }

    if (body.online) {
      await this.markOnline(deviceId, endpoint)
    } else {
      await this.redis.del(`${DEVICE_ONLINE_PREFIX}${deviceId}`)
    }

    const online = body.online
    return toDevice(updated, online)
  }

  async authenticateDeviceToken(token: string): Promise<{ deviceId: string; userId: string }> {
    const rows = await this.db.select().from(devices)
    for (const row of rows) {
      if (await verifyDeviceToken(token, row.accessTokenHash)) {
        return { deviceId: row.id, userId: row.userId }
      }
    }
    throw new AuthError('invalid_token', '无效的设备令牌')
  }

  private async markOnline(deviceId: string, endpoint?: string): Promise<void> {
    await this.redis.set(`${DEVICE_ONLINE_PREFIX}${deviceId}`, endpoint ?? '1', 'EX', DEVICE_ONLINE_TTL_SECONDS)
  }
}

export class DeviceError extends Error {
  constructor(
    readonly code: 'invalid_pair_code' | 'pair_failed' | 'device_not_found',
    message: string,
  ) {
    super(message)
    this.name = 'DeviceError'
  }
}

/** 配对码比较（大小写不敏感） */
export function normalizePairCode(code: string): string {
  return code.trim().toUpperCase()
}

export function isPairCodeMatch(input: string, stored: string): boolean {
  return safeEqualString(normalizePairCode(input), normalizePairCode(stored))
}
