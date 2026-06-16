import { eq } from 'drizzle-orm'
import type { AuthCredential } from '@muse-ai/shared'
import type { MuseDb } from '../db/client.js'
import { userSettings } from '../db/schema.js'
import type { CredentialStore } from '../stores/credential-store.js'
import { ProviderConfigStore } from '../stores/provider-config-store.js'
import { resolveProviderApi, resolveProviderBaseUrl } from './provider-catalog.js'
import { mergeHeaderRecords } from '../utils/header-utils.js'

export interface ResolvedProxyProvider {
  providerId: string
  baseUrl: string
  api: string
  apiKey: string
  headers: Record<string, string>
}

export class ProviderResolver {
  private readonly configStore: ProviderConfigStore

  constructor(
    private readonly db: MuseDb,
    private readonly credentialStore: CredentialStore,
  ) {
    this.configStore = new ProviderConfigStore(db)
  }

  private extractApiKey(credential: AuthCredential | undefined): string | undefined {
    if (!credential) return undefined
    if (credential.type === 'api_key' && credential.key.trim()) {
      return credential.key.trim()
    }
    return undefined
  }

  async resolve(userId: string, providerHint?: string): Promise<ResolvedProxyProvider | undefined> {
    const hint = providerHint?.trim()
    if (hint) {
      const resolved = await this.tryResolve(userId, hint)
      if (resolved) return resolved
    }

    const defaultProviderId = await this.resolveDefaultProviderId(userId)
    if (defaultProviderId && defaultProviderId !== hint) {
      return this.tryResolve(userId, defaultProviderId)
    }

    return undefined
  }

  private async tryResolve(userId: string, providerId: string): Promise<ResolvedProxyProvider | undefined> {
    const modelsStore = await this.configStore.readAll(userId)

    const override = modelsStore.providers?.[providerId]
    const baseUrl = resolveProviderBaseUrl(providerId, override)
    if (!baseUrl) return undefined

    const credential = await this.credentialStore.get(userId, providerId)
    const apiKey = this.extractApiKey(credential) ?? ''

    if (!apiKey) return undefined

    return {
      providerId,
      baseUrl,
      api: resolveProviderApi(providerId, override),
      apiKey,
      headers: mergeHeaderRecords(override?.headers) ?? {},
    }
  }

  private async resolveDefaultProviderId(userId: string): Promise<string | undefined> {
    const [row] = await this.db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1)
    return row?.defaultProvider ?? undefined
  }
}
