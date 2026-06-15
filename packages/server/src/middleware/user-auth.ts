import { createMiddleware } from 'hono/factory'
import { AuthError, type AuthService } from '../services/auth-service.js'
import type { ServerVariables } from '../types.js'

export function createUserAuthMiddleware(authService: AuthService) {
  return createMiddleware<{ Variables: ServerVariables }>(async (c, next) => {
    const header = c.req.header('Authorization')
    if (!header?.startsWith('Bearer ')) {
      return c.json({ error: 'unauthorized', message: '缺少 Authorization Bearer 令牌' }, 401)
    }
    const token = header.slice('Bearer '.length).trim()
    try {
      const user = await authService.verifyAccessToken(token)
      c.set('user', user)
      await next()
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        return c.json({ error: error.code, message: error.message }, 401)
      }
      throw error
    }
  })
}
