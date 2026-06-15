import { DEFAULT_PORTS } from '@muse-ai/shared'

export interface ServerConfig {
  host: string
  port: number
  databaseUrl: string
  redisUrl: string
  jwtSecret: string
  encryptionKey: string
}

export function loadServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const port = env.PORT ? Number.parseInt(env.PORT, 10) : DEFAULT_PORTS.SERVER
  const jwtSecret = env.JWT_SECRET?.trim()
  const encryptionKey = env.ENCRYPTION_KEY?.trim()

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
  }
}
