import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema.js'

export type MuseDb = ReturnType<typeof createDb>['db']

export function createDb(databaseUrl: string) {
  const pool = new pg.Pool({ connectionString: databaseUrl })
  const db = drizzle(pool, { schema })
  return { db, pool }
}

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  access_token_hash TEXT NOT NULL,
  endpoint TEXT,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS devices_user_id_idx ON devices(user_id);

ALTER TABLE devices ADD COLUMN IF NOT EXISTS access_token_encrypted TEXT;

DROP TABLE IF EXISTS providers CASCADE;

CREATE TABLE IF NOT EXISTS user_provider_credentials (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  credential_encrypted TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, provider_id)
);

CREATE TABLE IF NOT EXISTS user_provider_config (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  base_url TEXT,
  api TEXT,
  headers_json TEXT NOT NULL DEFAULT '[]',
  models_json TEXT NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, provider_id)
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  default_provider TEXT,
  default_model TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS model_strategy_json TEXT;

CREATE INDEX IF NOT EXISTS user_provider_credentials_user_id_idx ON user_provider_credentials(user_id);
CREATE INDEX IF NOT EXISTS user_provider_config_user_id_idx ON user_provider_config(user_id);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_token_idx ON refresh_tokens(token);
`

export async function initDatabase(pool: pg.Pool): Promise<void> {
  await pool.query(INIT_SQL)
}
