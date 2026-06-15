import { and, desc, eq } from 'drizzle-orm'
import type { ProviderCreate, ProviderSummary, ProviderUpdate } from '@muse-ai/shared'
import { providerSummarySchema } from '@muse-ai/shared'
import { decryptSecret, encryptSecret } from '../crypto/aes-gcm.js'
import type { MuseDb } from '../db/client.js'
import { providers } from '../db/schema.js'

export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1'

function toSummary(row: typeof providers.$inferSelect): ProviderSummary {
  return providerSummarySchema.parse({
    id: row.id,
    name: row.name,
    baseUrl: row.baseUrl,
    isDefault: row.isDefault,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  })
}

export interface ResolvedProvider {
  id: string
  name: string
  baseUrl: string
  apiKey: string
}

export class ProviderService {
  constructor(
    private readonly db: MuseDb,
    private readonly encryptionKey: string,
  ) {}

  async list(userId: string): Promise<ProviderSummary[]> {
    const rows = await this.db.select().from(providers).where(eq(providers.userId, userId)).orderBy(desc(providers.createdAt))
    return rows.map(toSummary)
  }

  async create(userId: string, input: ProviderCreate): Promise<ProviderSummary> {
    const now = new Date().toISOString()
    const baseUrl = input.baseUrl ?? DEFAULT_OPENAI_BASE_URL
    const apiKeyEncrypted = encryptSecret(input.apiKey, this.encryptionKey)

    if (input.isDefault) {
      await this.db.update(providers).set({ isDefault: false }).where(eq(providers.userId, userId))
    }

    const shouldDefault = input.isDefault ?? (await this.countForUser(userId)) === 0

    const [row] = await this.db
      .insert(providers)
      .values({
        userId,
        name: input.name,
        baseUrl,
        apiKeyEncrypted,
        isDefault: shouldDefault,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    if (!row) throw new ProviderError('create_failed', 'Provider 创建失败')
    return toSummary(row)
  }

  async update(userId: string, providerId: string, input: ProviderUpdate): Promise<ProviderSummary> {
    const existing = await this.getOwned(userId, providerId)
    if (!existing) {
      throw new ProviderError('not_found', 'Provider 不存在')
    }

    if (input.isDefault) {
      await this.db.update(providers).set({ isDefault: false }).where(eq(providers.userId, userId))
    }

    const patch: Partial<typeof providers.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    }
    if (input.name !== undefined) patch.name = input.name
    if (input.baseUrl !== undefined) patch.baseUrl = input.baseUrl
    if (input.apiKey !== undefined) patch.apiKeyEncrypted = encryptSecret(input.apiKey, this.encryptionKey)
    if (input.isDefault !== undefined) patch.isDefault = input.isDefault

    const [row] = await this.db.update(providers).set(patch).where(eq(providers.id, providerId)).returning()
    if (!row) throw new ProviderError('not_found', 'Provider 不存在')
    return toSummary(row)
  }

  async remove(userId: string, providerId: string): Promise<void> {
    const existing = await this.getOwned(userId, providerId)
    if (!existing) {
      throw new ProviderError('not_found', 'Provider 不存在')
    }
    await this.db.delete(providers).where(and(eq(providers.id, providerId), eq(providers.userId, userId)))
  }

  async resolveDefaultForUser(userId: string): Promise<ResolvedProvider | undefined> {
    const [row] = await this.db
      .select()
      .from(providers)
      .where(and(eq(providers.userId, userId), eq(providers.isDefault, true)))
      .limit(1)

    const target = row ?? (await this.db.select().from(providers).where(eq(providers.userId, userId)).orderBy(desc(providers.createdAt)).limit(1))[0]

    if (!target) return undefined

    return {
      id: target.id,
      name: target.name,
      baseUrl: target.baseUrl,
      apiKey: decryptSecret(target.apiKeyEncrypted, this.encryptionKey),
    }
  }

  private async getOwned(userId: string, providerId: string) {
    const [row] = await this.db
      .select()
      .from(providers)
      .where(and(eq(providers.id, providerId), eq(providers.userId, userId)))
      .limit(1)
    return row
  }

  private async countForUser(userId: string): Promise<number> {
    const rows = await this.db.select({ id: providers.id }).from(providers).where(eq(providers.userId, userId))
    return rows.length
  }
}

export class ProviderError extends Error {
  constructor(
    readonly code: 'not_found' | 'create_failed' | 'no_provider',
    message: string,
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}
