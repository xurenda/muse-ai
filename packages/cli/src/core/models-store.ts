import type {
  MuseModelsConfig,
  MuseProviderDefinition,
  ProviderAdvancedConfig,
  UpsertProviderAdvancedConfigRequest,
} from '@muse-ai/shared'
import { getModelsPath } from '../data/paths'
import { DEFAULT_MODELS } from '../data/defaults'
import { headersEntriesToRecord, headersRecordToEntries } from './header-utils'
import { readJsonFileIfExists } from './read-json-file'
import { writeJsonFile } from './write-json-file'

export async function readModelsStore(): Promise<MuseModelsConfig> {
  return (await readJsonFileIfExists<MuseModelsConfig>(getModelsPath())) ?? DEFAULT_MODELS
}

export async function writeModelsStore(data: MuseModelsConfig): Promise<void> {
  await writeJsonFile(getModelsPath(), data)
}

export function providerConfigToAdvanced(
  providerConfig: MuseProviderDefinition | undefined,
): ProviderAdvancedConfig {
  return {
    baseUrl: providerConfig?.baseUrl,
    headers: headersRecordToEntries(providerConfig?.headers),
    extraModels: (providerConfig?.models ?? []).map((model) => ({
      id: model.id,
      name: model.name ?? model.id,
      headers: headersRecordToEntries(model.headers),
    })),
  }
}

function pruneProviderAdvancedFields(provider: MuseProviderDefinition): MuseProviderDefinition | undefined {
  const next: MuseProviderDefinition = { ...provider }

  if (!next.baseUrl?.trim()) {
    delete next.baseUrl
  }
  if (!next.headers || Object.keys(next.headers).length === 0) {
    delete next.headers
  }
  if (!next.models?.length) {
    delete next.models
  }

  const hasContent =
    next.baseUrl !== undefined ||
    next.headers !== undefined ||
    next.models !== undefined ||
    next.api !== undefined ||
    next.apiKey !== undefined

  return hasContent ? next : undefined
}

export async function upsertBuiltinProviderAdvanced(
  providerId: string,
  input: UpsertProviderAdvancedConfigRequest,
): Promise<void> {
  const store = await readModelsStore()
  const providers = { ...store.providers }
  const existing = providers[providerId] ?? {}

  const extraModels = (input.extraModels ?? [])
    .map((model) => {
      const id = model.id.trim()
      if (!id) {
        return null
      }
      const headers = headersEntriesToRecord(model.headers)
      return {
        id,
        name: model.name?.trim() || id,
        ...(headers ? { headers } : {}),
      }
    })
    .filter((model): model is NonNullable<typeof model> => model !== null)

  const nextProvider: MuseProviderDefinition = {
    ...existing,
    baseUrl: input.baseUrl?.trim() || undefined,
    headers: headersEntriesToRecord(input.headers),
    models: extraModels.length > 0 ? extraModels : undefined,
  }

  const pruned = pruneProviderAdvancedFields(nextProvider)
  if (pruned) {
    providers[providerId] = pruned
  } else {
    delete providers[providerId]
  }

  await writeModelsStore({ ...store, providers })
}

export async function upsertCustomProvider(
  providerId: string,
  input: {
    baseUrl: string
    api: string
    apiKey?: string
    headers?: Array<{ key: string; value: string }>
    models: Array<{ id: string; name?: string; headers?: Array<{ key: string; value: string }> }>
  },
): Promise<void> {
  const store = await readModelsStore()
  const providers = { ...store.providers }
  const existing = providers[providerId] ?? {}

  const nextProvider: MuseProviderDefinition = {
    ...existing,
    baseUrl: input.baseUrl,
    api: input.api,
    headers: headersEntriesToRecord(input.headers),
    models: input.models.map((model) => ({
      id: model.id,
      name: model.name,
      headers: headersEntriesToRecord(model.headers),
    })),
  }

  if (input.apiKey?.trim()) {
    nextProvider.apiKey = input.apiKey.trim()
  } else {
    delete nextProvider.apiKey
  }

  providers[providerId] = nextProvider
  await writeModelsStore({ ...store, providers })
}

export async function removeCustomProvider(providerId: string): Promise<void> {
  const store = await readModelsStore()
  if (!store.providers?.[providerId]) {
    return
  }

  const providers = { ...store.providers }
  delete providers[providerId]
  await writeModelsStore({ ...store, providers })
}
