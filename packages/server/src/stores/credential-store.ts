import { and, eq } from 'drizzle-orm'
import type { AuthCredential } from '@museai/shared'
import { decryptSecret, encryptSecret } from '../crypto/aes-gcm.js'
import type { MuseDb } from '../db/client.js'
import { userProviderCredentials } from '../db/schema.js'

export class CredentialStore {
  constructor(
    private readonly db: MuseDb,
    private readonly encryptionKey: string,
  ) {}

  async get(userId: string, providerId: string): Promise<AuthCredential | undefined> {
    const [row] = await this.db
      .select()
      .from(userProviderCredentials)
      .where(and(eq(userProviderCredentials.userId, userId), eq(userProviderCredentials.providerId, providerId)))
      .limit(1)

    if (!row) return undefined
    const raw = decryptSecret(row.credentialEncrypted, this.encryptionKey)
    return JSON.parse(raw) as AuthCredential
  }

  async listProviderIds(userId: string): Promise<string[]> {
    const rows = await this.db.select().from(userProviderCredentials).where(eq(userProviderCredentials.userId, userId))
    return rows.map(row => row.providerId)
  }

  async set(userId: string, providerId: string, credential: AuthCredential): Promise<void> {
    const now = new Date().toISOString()
    const credentialEncrypted = encryptSecret(JSON.stringify(credential), this.encryptionKey)

    await this.db
      .insert(userProviderCredentials)
      .values({ userId, providerId, credentialEncrypted, updatedAt: now })
      .onConflictDoUpdate({
        target: [userProviderCredentials.userId, userProviderCredentials.providerId],
        set: { credentialEncrypted, updatedAt: now },
      })
  }

  async remove(userId: string, providerId: string): Promise<void> {
    await this.db.delete(userProviderCredentials).where(and(eq(userProviderCredentials.userId, userId), eq(userProviderCredentials.providerId, providerId)))
  }

  async readAll(userId: string): Promise<Record<string, AuthCredential>> {
    const rows = await this.db.select().from(userProviderCredentials).where(eq(userProviderCredentials.userId, userId))
    const result: Record<string, AuthCredential> = {}
    for (const row of rows) {
      const raw = decryptSecret(row.credentialEncrypted, this.encryptionKey)
      result[row.providerId] = JSON.parse(raw) as AuthCredential
    }
    return result
  }
}
