import type { IncomingMessage, ServerResponse } from 'node:http'
import type {
  UpdateModelsConfigRequest,
  UpdateProviderApiKeyRequest,
  UpsertCustomProviderRequest,
  UpsertProviderAdvancedConfigRequest,
} from '@muse-ai/shared'
import {
  deleteCustomProvider,
  deleteProviderApiKey,
  getModelsConfig,
  getProvidersConfig,
  saveBuiltinProviderAdvanced,
  saveCustomProvider,
  saveProviderApiKey,
  updateModelsConfig,
} from '../../core/settings-service'
import { readJsonBody } from '../read-body'

type SendJson = (response: ServerResponse, statusCode: number, body: unknown) => void
type SendError = (response: ServerResponse, statusCode: number, message: string) => void

const CUSTOM_PROVIDER_PATTERN = /^\/settings\/providers\/custom\/([^/]+)$/
const API_KEY_PROVIDER_PATTERN = /^\/settings\/providers\/([^/]+)\/api-key$/
const ADVANCED_PROVIDER_PATTERN = /^\/settings\/providers\/([^/]+)\/advanced-config$/

export async function handleSettingsRoute(
  method: string,
  pathname: string,
  request: IncomingMessage,
  response: ServerResponse,
  sendJson: SendJson,
  sendError: SendError,
): Promise<boolean> {
  if (method === 'GET' && pathname === '/settings/models-config') {
    sendJson(response, 200, await getModelsConfig())
    return true
  }

  if (method === 'PATCH' && pathname === '/settings/models-config') {
    const body = await readJsonBody<UpdateModelsConfigRequest>(request)
    if (!body.defaultProvider || !body.defaultModel) {
      sendError(response, 400, 'defaultProvider 与 defaultModel 不能为空')
      return true
    }
    try {
      await updateModelsConfig(body)
      sendJson(response, 200, { ok: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      sendError(response, 400, message)
    }
    return true
  }

  if (method === 'GET' && pathname === '/settings/providers') {
    sendJson(response, 200, await getProvidersConfig())
    return true
  }

  const advancedMatch = pathname.match(ADVANCED_PROVIDER_PATTERN)
  if (advancedMatch) {
    const providerId = advancedMatch[1]
    if (method === 'PUT') {
      const body = await readJsonBody<UpsertProviderAdvancedConfigRequest>(request)
      try {
        await saveBuiltinProviderAdvanced(providerId, body)
        sendJson(response, 200, { ok: true })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        sendError(response, 400, message)
      }
      return true
    }
  }

  const apiKeyMatch = pathname.match(API_KEY_PROVIDER_PATTERN)
  if (apiKeyMatch) {
    const providerId = apiKeyMatch[1]
    if (method === 'PUT') {
      const body = await readJsonBody<UpdateProviderApiKeyRequest>(request)
      try {
        await saveProviderApiKey(providerId, body.apiKey)
        sendJson(response, 200, { ok: true })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        sendError(response, 400, message)
      }
      return true
    }

    if (method === 'DELETE') {
      await deleteProviderApiKey(providerId)
      sendJson(response, 200, { ok: true })
      return true
    }
  }

  const customMatch = pathname.match(CUSTOM_PROVIDER_PATTERN)
  if (customMatch) {
    const providerId = customMatch[1]
    if (method === 'PUT') {
      const body = await readJsonBody<UpsertCustomProviderRequest>(request)
      try {
        await saveCustomProvider(providerId, body)
        sendJson(response, 200, { ok: true })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        sendError(response, 400, message)
      }
      return true
    }

    if (method === 'DELETE') {
      await deleteCustomProvider(providerId)
      sendJson(response, 200, { ok: true })
      return true
    }
  }

  return false
}
