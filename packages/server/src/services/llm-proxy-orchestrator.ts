import { MUSE_PROXY_HEADERS, parseMuseLlmTask, parseProviderIdFromModelRef, type MuseLlmTask } from '@muse-ai/shared'
import { isRetryableModelError } from '@muse-ai/core'
import type { ModelResolutionService } from './model-resolution-service.js'
import type { LlmProxyService } from './llm-proxy-service.js'
import { isProviderAuthError, markProviderAuthFailure } from './provider-health.js'
import type { ProviderResolver } from './provider-resolver.js'
import { SettingsError } from './settings-service.js'

export interface LlmProxyRequestContext {
  userId: string
  suffixPath: string
  body: unknown
  incomingHeaders: Headers
  signal?: AbortSignal
  taskHeader: string | null
  selectionHeader: string | null
  providerHint: string | undefined
}

export interface LlmProxySuccessMeta {
  modelRef: string
  usedFallback: boolean
  attemptedModelRefs: readonly string[]
}

function splitModelRef(modelRef: string): { providerId: string; modelId: string } | null {
  const providerId = parseProviderIdFromModelRef(modelRef)
  if (!providerId) return null
  const modelId = modelRef.slice(providerId.length + 1)
  if (!modelId) return null
  return { providerId, modelId }
}

function withModelInBody(body: unknown, modelId: string): unknown {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return body
  }
  return { ...body, model: modelId }
}

function copyUpstreamHeaders(upstream: Response, target: Headers): void {
  const contentType = upstream.headers.get('content-type')
  if (contentType) target.set('content-type', contentType)
  const cacheControl = upstream.headers.get('cache-control')
  if (cacheControl) target.set('cache-control', cacheControl)
}

function applyResolvedModelHeaders(headers: Headers, meta: LlmProxySuccessMeta): void {
  headers.set(MUSE_PROXY_HEADERS.RESOLVED_MODEL, meta.modelRef)
  headers.set(MUSE_PROXY_HEADERS.FALLBACK_USED, meta.usedFallback ? 'true' : 'false')
  if (meta.attemptedModelRefs.length > 0) {
    headers.set(MUSE_PROXY_HEADERS.ATTEMPTED_MODELS, meta.attemptedModelRefs.join(','))
  }
}

/** Server LLM 代理：解析 model-strategy、顺序 fallback、回传 resolved 头 */
export class LlmProxyOrchestrator {
  constructor(
    private readonly modelResolution: ModelResolutionService,
    private readonly providerResolver: ProviderResolver,
    private readonly llmProxy: LlmProxyService,
  ) {}

  async handle(context: LlmProxyRequestContext): Promise<Response> {
    const task = parseMuseLlmTask(context.taskHeader)
    if (task) {
      return this.handleWithResolution(context, task)
    }
    return this.handleLegacy(context)
  }

  private async handleWithResolution(context: LlmProxyRequestContext, task: MuseLlmTask): Promise<Response> {
    const resolution = await this.modelResolution.resolveCandidates({
      userId: context.userId,
      task,
      selectionHeader: context.selectionHeader,
    })

    if (resolution.candidates.length === 0) {
      return Response.json(
        {
          error: 'pool_empty',
          message: '当前模型池无已配置凭证的候选模型',
          attemptedModelRefs: resolution.expandedCandidates,
        },
        { status: 503 },
      )
    }

    const attemptedModelRefs: string[] = []
    let lastResponse: Response | undefined
    let lastForwardError: unknown

    for (let index = 0; index < resolution.candidates.length; index++) {
      const modelRef = resolution.candidates[index]
      if (!modelRef) continue

      attemptedModelRefs.push(modelRef)
      const parts = splitModelRef(modelRef)
      if (!parts) continue

      const provider = await this.providerResolver.resolve(context.userId, parts.providerId)
      if (!provider) continue

      const forwardBody = withModelInBody(context.body, parts.modelId)
      let upstream: Response
      try {
        upstream = await this.llmProxy.forward(provider, context.suffixPath, forwardBody, context.incomingHeaders, context.signal)
      } catch (error: unknown) {
        lastResponse = undefined
        lastForwardError = error
        const hasMore = index < resolution.candidates.length - 1
        if (!hasMore || !isRetryableModelError(error)) {
          break
        }
        continue
      }

      if (upstream.ok) {
        const headers = new Headers()
        copyUpstreamHeaders(upstream, headers)
        applyResolvedModelHeaders(headers, {
          modelRef,
          usedFallback: index > 0,
          attemptedModelRefs,
        })
        return new Response(upstream.body, { status: upstream.status, headers })
      }

      lastResponse = upstream
      lastForwardError = undefined
      const hasMore = index < resolution.candidates.length - 1
      if (!hasMore || !isRetryableModelError({ status: upstream.status })) {
        break
      }

      const errorText = await upstream.clone().text()
      if (isProviderAuthError(errorText)) {
        markProviderAuthFailure(context.userId, provider.providerId, errorText.slice(0, 500))
      }
    }

    if (!lastResponse && !lastForwardError) {
      return Response.json({ error: 'pool_empty', message: '无法解析可用模型' }, { status: 503 })
    }

    if (lastForwardError) {
      const message = lastForwardError instanceof Error ? lastForwardError.message : String(lastForwardError)
      const headers = new Headers()
      if (attemptedModelRefs.length > 0) {
        headers.set(MUSE_PROXY_HEADERS.ATTEMPTED_MODELS, attemptedModelRefs.join(','))
      }
      return Response.json({ error: 'upstream_failed', message, attemptedModelRefs }, { status: 502, headers })
    }

    const headers = new Headers()
    copyUpstreamHeaders(lastResponse!, headers)
    if (attemptedModelRefs.length > 0) {
      headers.set(MUSE_PROXY_HEADERS.ATTEMPTED_MODELS, attemptedModelRefs.join(','))
    }
    return new Response(lastResponse!.body, { status: lastResponse!.status, headers })
  }

  private async handleLegacy(context: LlmProxyRequestContext): Promise<Response> {
    const provider = await this.providerResolver.resolve(context.userId, context.providerHint)
    if (!provider) {
      throw new SettingsError('no_provider', '未配置 LLM Provider：请先在 Web 设置页配置供应方凭证')
    }

    const upstream = await this.llmProxy.forward(provider, context.suffixPath, context.body, context.incomingHeaders, context.signal)

    if (!upstream.ok) {
      const errorText = await upstream.clone().text()
      if (isProviderAuthError(errorText)) {
        markProviderAuthFailure(context.userId, provider.providerId, errorText.slice(0, 500))
      }
    }

    const headers = new Headers()
    copyUpstreamHeaders(upstream, headers)
    return new Response(upstream.body, { status: upstream.status, headers })
  }
}
