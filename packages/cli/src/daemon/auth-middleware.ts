import { createMiddleware } from 'hono/factory'
import type { MuseConfig } from '../paths.js'

export interface CliAuthState {
  deviceToken?: string
}

/** 已配置 deviceToken 时校验 Bearer；未配对时放行（开发/curl 友好） */
export function createCliAuthMiddleware(authState: CliAuthState) {
  return createMiddleware(async (c, next) => {
    if (!authState.deviceToken) {
      await next()
      return
    }

    const header = c.req.header('Authorization')
    if (!header?.startsWith('Bearer ')) {
      return c.json({ error: 'unauthorized', message: '缺少设备 Authorization Bearer 令牌' }, 401)
    }

    const token = header.slice('Bearer '.length).trim()
    if (token !== authState.deviceToken) {
      return c.json({ error: 'unauthorized', message: '设备令牌无效' }, 401)
    }

    await next()
  })
}

export function resolveCliAuthState(config: MuseConfig): CliAuthState {
  return { deviceToken: config.deviceToken }
}
