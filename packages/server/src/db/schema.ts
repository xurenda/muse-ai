import { boolean, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
})

/** 替代 auth.json：provider slug → 加密凭证（api_key / oauth） */
export const userProviderCredentials = pgTable(
  'user_provider_credentials',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    providerId: text('provider_id').notNull(),
    credentialEncrypted: text('credential_encrypted').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  table => [primaryKey({ columns: [table.userId, table.providerId] })],
)

/** 替代 models.json：内置覆盖 + 自定义 provider 定义 */
export const userProviderConfig = pgTable(
  'user_provider_config',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    providerId: text('provider_id').notNull(),
    baseUrl: text('base_url'),
    api: text('api'),
    headersJson: text('headers_json').notNull().default('[]'),
    modelsJson: text('models_json').notNull().default('[]'),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  table => [primaryKey({ columns: [table.userId, table.providerId] })],
)

export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  defaultProvider: text('default_provider'),
  defaultModel: text('default_model'),
  modelStrategyJson: text('model_strategy_json'),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
})

export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  accessTokenHash: text('access_token_hash').notNull(),
  accessTokenEncrypted: text('access_token_encrypted'),
  endpoint: text('endpoint'),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
})

/** 用户 refresh token 表，支持 token 轮换与多设备会话 */
export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** 存储 token 本身（足够随机，可安全存明文；如需更高安全可改为 hash） */
  token: text('token').notNull().unique(),
  /** 是否已被吊销（轮换后旧 token 立即标记） */
  revoked: boolean('revoked').notNull().default(false),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
})

export type UserProviderCredentialRow = typeof userProviderCredentials.$inferSelect
export type UserProviderConfigRow = typeof userProviderConfig.$inferSelect
export type RefreshTokenRow = typeof refreshTokens.$inferSelect
