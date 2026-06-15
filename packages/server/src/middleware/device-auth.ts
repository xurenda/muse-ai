import { createMiddleware } from 'hono/factory'
import { AuthError } from '../services/auth-service.js'
import type { DeviceService } from '../services/device-service.js'
import type { ServerVariables } from '../types.js'

export function createDeviceAuthMiddleware(deviceService: DeviceService) {
  return createMiddleware<{ Variables: ServerVariables }>(async (c, next) => {
    const header = c.req.header('Authorization')
    if (!header?.startsWith('Bearer ')) {
      return c.json({ error: 'unauthorized', message: '缺少设备 Authorization Bearer 令牌' }, 401)
    }
    const token = header.slice('Bearer '.length).trim()
    try {
      const auth = await deviceService.authenticateDeviceToken(token)
      c.set('deviceAuth', auth)
      await next()
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        return c.json({ error: error.code, message: error.message }, 401)
      }
      throw error
    }
  })
}
