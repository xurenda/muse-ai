import type { AuthUser } from './services/auth-service.js'

export type ServerVariables = {
  user: AuthUser
  deviceAuth: { deviceId: string; userId: string }
}
