import { DEFAULT_PORTS } from '@museai/shared'

export interface CliConfig {
  host: string
  port: number
  corsOrigins: string[]
}

export function loadCliConfig(env: NodeJS.ProcessEnv = process.env): CliConfig {
  const port = env.MUSE_CLI_PORT ? Number.parseInt(env.MUSE_CLI_PORT, 10) : DEFAULT_PORTS.CLI
  const corsOrigins = env.MUSE_CORS_ORIGINS?.split(',')
    .map(s => s.trim())
    .filter(Boolean) ?? [`http://localhost:${DEFAULT_PORTS.WEB_DEV}`]

  return {
    host: env.MUSE_CLI_HOST ?? '127.0.0.1',
    port: Number.isFinite(port) ? port : DEFAULT_PORTS.CLI,
    corsOrigins,
  }
}
