import { and, eq } from 'drizzle-orm'
import type {
  MuseModelsConfig,
  MuseProviderDefinition,
  ProviderAdvancedConfig,
  UpsertCustomProviderRequest,
  UpsertProviderAdvancedConfigRequest,
} from '@museai/shared'
import type { MuseDb } from '../db/client.js'
import { userProviderConfig } from '../db/schema.js'
import { headersEntriesToRecord, headersRecordToEntries } from '../utils/header-utils.js'

function parseModelsJson(raw: string): MuseProviderDefinition['models'] {
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as MuseProviderDefinition['models']) : []
  } catch {
    return []
  }
}

function parseHeadersJson(raw: string): MuseProviderDefinition['headers'] {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return undefined
    return headersEntriesToRecord(parsed as Array<{ key: string; value: string }>)
  } catch {
    return undefined
  }
}

function rowToDefinition(row: typeof userProviderConfig.$inferSelect): MuseProviderDefinition {
  return {
    baseUrl: row.baseUrl ?? undefined,
    api: row.api ?? undefined,
    headers: parseHeadersJson(row.headersJson),
    models: parseModelsJson(row.modelsJson),
  }
}

export function providerConfigToAdvanced(providerConfig: MuseProviderDefinition | undefined): ProviderAdvancedConfig {
  return {
    baseUrl: providerConfig?.baseUrl,
    headers: headersRecordToEntries(providerConfig?.headers),
    extraModels: (providerConfig?.models ?? []).map(model => ({
      id: model.id,
      name: model.name ?? model.id,
      headers: headersRecordToEntries(model.headers),
    })),
  }
}

export class ProviderConfigStore {
  constructor(private readonly db: MuseDb) {}

  async readAll(userId: string): Promise<MuseModelsConfig> {
    const rows = await this.db.select().from(userProviderConfig).where(eq(userProviderConfig.userId, userId))
    const providers: Record<string, MuseProviderDefinition> = {}
    for (const row of rows) {
      providers[row.providerId] = rowToDefinition(row)
    }
    return { providers }
  }

  async getProvider(userId: string, providerId: string): Promise<MuseProviderDefinition | undefined> {
    const [row] = await this.db
      .select()
      .from(userProviderConfig)
      .where(and(eq(userProviderConfig.userId, userId), eq(userProviderConfig.providerId, providerId)))
      .limit(1)
    return row ? rowToDefinition(row) : undefined
  }

  private async upsertProvider(userId: string, providerId: string, definition: MuseProviderDefinition): Promise<void> {
    const now = new Date().toISOString()
    await this.db
      .insert(userProviderConfig)
      .values({
        userId,
        providerId,
        baseUrl: definition.baseUrl ?? null,
        api: definition.api ?? null,
        headersJson: JSON.stringify(headersRecordToEntries(definition.headers) ?? []),
        modelsJson: JSON.stringify(definition.models ?? []),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [userProviderConfig.userId, userProviderConfig.providerId],
        set: {
          baseUrl: definition.baseUrl ?? null,
          api: definition.api ?? null,
          headersJson: JSON.stringify(headersRecordToEntries(definition.headers) ?? []),
          modelsJson: JSON.stringify(definition.models ?? []),
          updatedAt: now,
        },
      })
  }

  private async pruneProvider(userId: string, providerId: string, definition: MuseProviderDefinition): Promise<void> {
    const hasContent =
      Boolean(definition.baseUrl?.trim()) ||
      Boolean(definition.api?.trim()) ||
      Boolean(definition.headers && Object.keys(definition.headers).length > 0) ||
      Boolean(definition.models?.length)

    if (!hasContent) {
      await this.db.delete(userProviderConfig).where(and(eq(userProviderConfig.userId, userId), eq(userProviderConfig.providerId, providerId)))
      return
    }

    await this.upsertProvider(userId, providerId, definition)
  }

  async upsertBuiltinAdvanced(userId: string, providerId: string, input: UpsertProviderAdvancedConfigRequest): Promise<void> {
    const store = await this.readAll(userId)
    const existing = store.providers?.[providerId] ?? {}

    const extraModels = (input.extraModels ?? [])
      .map(model => {
        const id = model.id.trim()
        if (!id) return null
        return {
          id,
          name: model.name?.trim() || id,
          headers: headersEntriesToRecord(model.headers),
        }
      })
      .filter((model): model is NonNullable<typeof model> => model !== null)

    const next: MuseProviderDefinition = {
      ...existing,
      baseUrl: input.baseUrl?.trim() || undefined,
      headers: headersEntriesToRecord(input.headers),
      models: extraModels.length > 0 ? extraModels : undefined,
    }

    await this.pruneProvider(userId, providerId, next)
  }

  async upsertCustom(userId: string, providerId: string, input: UpsertCustomProviderRequest): Promise<void> {
    const store = await this.readAll(userId)
    const existing = store.providers?.[providerId] ?? {}

    const next: MuseProviderDefinition = {
      ...existing,
      baseUrl: input.baseUrl.trim(),
      api: input.api,
      headers: headersEntriesToRecord(input.headers),
      models: input.models.map(model => ({
        id: model.id,
        name: model.name,
        headers: headersEntriesToRecord(model.headers),
      })),
    }

    await this.upsertProvider(userId, providerId, next)
  }

  async removeCustom(userId: string, providerId: string): Promise<void> {
    await this.db.delete(userProviderConfig).where(and(eq(userProviderConfig.userId, userId), eq(userProviderConfig.providerId, providerId)))
  }
}
