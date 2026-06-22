import { modelStrategyConfigSchema, SERVER_API_PATHS, type ModelStrategyResponse } from '@muse-ai/shared'

export async function fetchModelStrategy(backendUrl: string, deviceToken: string): Promise<ModelStrategyResponse> {
  const base = backendUrl.replace(/\/+$/, '')
  const res = await fetch(`${base}${SERVER_API_PATHS.SETTINGS_MODEL_STRATEGY}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${deviceToken}`,
    },
  })

  const body: unknown = await res.json()
  if (!res.ok) {
    const message = typeof body === 'object' && body !== null && 'message' in body ? String((body as { message?: unknown }).message) : res.statusText
    throw new Error(`拉取 model-strategy 失败 (${res.status}): ${message}`)
  }

  const strategy = (body as ModelStrategyResponse).strategy
  const parsed = modelStrategyConfigSchema.safeParse(strategy)
  if (!parsed.success) {
    throw new Error('model-strategy 响应格式无效')
  }

  return body as ModelStrategyResponse
}
