import { DEFAULT_PORTS } from '@museai/shared'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const serverPackageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

export interface ServerConfig {
  host: string
  port: number
  databaseUrl: string
  redisUrl: string
  jwtSecret: string
  encryptionKey: string
  /** 允许跨域的 Web 来源，如 http://localhost:65434 */
  corsOrigins: string[]
  /** 市场 .musepack 本地存储根目录 */
  marketDataDir: string
  /** 对外可访问的 Server 根 URL，用于生成 downloadUrl */
  publicBaseUrl: string
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

  const host = env.HOST ?? '127.0.0.1'
  const resolvedPort = Number.isFinite(port) ? port : DEFAULT_PORTS.SERVER
  const publicHost = host === '0.0.0.0' ? '127.0.0.1' : host
  const publicBaseUrl = env.PUBLIC_BASE_URL?.trim() || `http://${publicHost}:${resolvedPort}`

  return {
    host,
    port: resolvedPort,
    databaseUrl: env.DATABASE_URL ?? 'postgresql://muse:muse@localhost:5432/muse',
    redisUrl: env.REDIS_URL ?? 'redis://localhost:6379',
    jwtSecret,
    encryptionKey,
    corsOrigins,
    marketDataDir: env.MARKET_DATA_DIR?.trim() || join(serverPackageRoot, 'data', 'market'),
    publicBaseUrl,
  }
}
