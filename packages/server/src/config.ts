import { DEFAULT_PORTS } from "@muse-ai/shared";

export interface ServerConfig {
  host: string;
  port: number;
  databaseUrl: string;
  redisUrl: string;
}

export function loadServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const port = env.PORT ? Number.parseInt(env.PORT, 10) : DEFAULT_PORTS.SERVER;

  return {
    host: env.HOST ?? "127.0.0.1",
    port: Number.isFinite(port) ? port : DEFAULT_PORTS.SERVER,
    databaseUrl: env.DATABASE_URL ?? "postgresql://muse:muse@localhost:5432/muse",
    redisUrl: env.REDIS_URL ?? "redis://localhost:6379",
  };
}
