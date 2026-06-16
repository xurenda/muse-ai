import { DEFAULT_PORTS } from '@muse-ai/shared'

export interface ServerConfig {
  host: string
  port: number
  databaseUrl: string
  redisUrl: string
  jwtSecret: string
  encryptionKey: string
  /** 允许跨域的 Web 来源，如 http://localhost:5173 */
  corsOrigins: string[]
}

export function loadServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const port = env.PORT ? Number.parseInt(env.PORT, 10) : DEFAULT_PORTS.SERVER
  const jwtSecret = env.JWT_SECRET?.trim()
  const encryptionKey = env.ENCRYPTION_KEY?.trim()
  const corsOrigins = env.MUSE_CORS_ORIGINS?.split(',')
    .map(s => s.trim())
    .filter(Boolean) ?? [`http://localhost:${DEFAULT_PORTS.WEB_DEV}`, `http://127.0.0.1:${DEFAULT_PORTS.WEB_DEV}`]

  if (!jwtSecret) {
    throw new Error('缺少环境变量 JWT_SECRET')
  }
  if (!encryptionKey) {
    throw new Error('缺少环境变量 ENCRYPTION_KEY')
  }

  return {
    host: env.HOST ?? '127.0.0.1',
    port: Number.isFinite(port) ? port : DEFAULT_PORTS.SERVER,
    databaseUrl: env.DATABASE_URL ?? 'postgresql://muse:muse@localhost:5432/muse',
    redisUrl: env.REDIS_URL ?? 'redis://localhost:6379',
    jwtSecret,
    encryptionKey,
    corsOrigins,
  }
}
