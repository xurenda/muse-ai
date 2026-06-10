import type { ApiKeyCredential, AuthStorageData } from '@muse-ai/shared'
import { getAuthPath } from '../data/paths'
import { readAuthData } from './read-json-file'
import { writeJsonFile } from './write-json-file'

export async function readAuthStore(): Promise<AuthStorageData> {
  return readAuthData(getAuthPath())
}

export async function writeAuthStore(data: AuthStorageData): Promise<void> {
  await writeJsonFile(getAuthPath(), data, 0o600)
}

export async function setProviderApiKey(providerId: string, apiKey: string): Promise<void> {
  const auth = await readAuthStore()
  const credential: ApiKeyCredential = { type: 'api_key', key: apiKey.trim() }
  auth[providerId] = credential
  await writeAuthStore(auth)
}

export async function removeProviderApiKey(providerId: string): Promise<void> {
  const auth = await readAuthStore()
  delete auth[providerId]
  await writeAuthStore(auth)
}
