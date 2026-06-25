import { AsyncLocalStorage } from 'node:async_hooks'
import { encodeModelSelectionHeader, MUSE_PROXY_HEADERS, type ModelSelection, type MuseLlmTask } from '@museai/shared'
import type { MuseSessionStore } from '@museai/core'
import type { SessionEventHub } from '@/daemon/event-hub.js'
import {
  llmInspectBufferUpdateRequest,
  llmInspectBufferUpdateResponseFromCompletionJson,
  llmInspectBufferUpdateResponseStatus,
  shouldCaptureLlmInspectTask,
  type LlmInspectResponseMeta,
} from '@/llm-inspect/llm-inspect-buffer.js'

export interface MuseProxyRuntimeContext {
  sessionId: string
  task: MuseLlmTask
  eventHub: SessionEventHub
  sessionStore: MuseSessionStore
}

const museProxyContextStorage = new AsyncLocalStorage<MuseProxyRuntimeContext>()

let interceptorInstalled = false

/** 在 Muse 代理请求上下文中执行（供 fetch 拦截器关联 session） */
export function runWithMuseProxyContext<T>(context: MuseProxyRuntimeContext, fn: () => Promise<T>): Promise<T> {
  return museProxyContextStorage.run(context, fn)
}

/** 安装全局 fetch 拦截：采集 LLM 快照、读取代理响应头并发布 model_resolved */
export function installMuseProxyFetchInterceptor(backendUrl: string): void {
  if (interceptorInstalled) return
  interceptorInstalled = true

  const base = backendUrl.replace(/\/$/, '')
  const prefix = `${base}/v1`
  const originalFetch = globalThis.fetch.bind(globalThis)

  globalThis.fetch = async (input: Parameters<typeof originalFetch>[0], init?: RequestInit): Promise<Response> => {
    const url = resolveFetchUrl(input)
    const context = url.startsWith(prefix) ? museProxyContextStorage.getStore() : undefined

    if (context && shouldCaptureLlmInspectTask(context.task)) {
      const payload = parseRequestPayload(init)
      if (payload !== undefined) {
        llmInspectBufferUpdateRequest(context.sessionId, context.task, payload)
      }
    }

    const response = await originalFetch(input, init)

    if (context) {
      await publishModelResolvedFromHeaders(response.headers, context)

      if (shouldCaptureLlmInspectTask(context.task)) {
        llmInspectBufferUpdateResponseStatus(context.sessionId, response.status, extractResponseMeta(response.headers))

        if (!isStreamingResponse(response) && response.ok) {
          try {
            const body: unknown = await response.clone().json()
            llmInspectBufferUpdateResponseFromCompletionJson(context.sessionId, body)
          } catch {
            // 非 JSON 响应忽略
          }
        }
      }
    }

    return response
  }
}

function resolveFetchUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

function parseRequestPayload(init?: RequestInit): unknown {
  if (init?.body === undefined || init.body === null) {
    return undefined
  }

  if (typeof init.body === 'string') {
    try {
      return JSON.parse(init.body) as unknown
    } catch {
      return init.body
    }
  }

  return init.body
}

function isStreamingResponse(response: Response): boolean {
  const contentType = response.headers.get('content-type') ?? ''
  return contentType.includes('text/event-stream')
}

function extractResponseMeta(headers: Headers): LlmInspectResponseMeta {
  const resolvedModel = headers.get(MUSE_PROXY_HEADERS.RESOLVED_MODEL) ?? undefined
  const usedFallback = headers.get(MUSE_PROXY_HEADERS.FALLBACK_USED) === 'true' ? true : undefined
  const attemptedHeader = headers.get(MUSE_PROXY_HEADERS.ATTEMPTED_MODELS)
  const attemptedModelRefs = attemptedHeader
    ? attemptedHeader
        .split(',')
        .map(ref => ref.trim())
        .filter(ref => ref.length > 0)
    : undefined

  const contextWindowHeader = headers.get(MUSE_PROXY_HEADERS.CONTEXT_WINDOW)
  const parsedContextWindow = contextWindowHeader ? Number.parseInt(contextWindowHeader, 10) : Number.NaN
  const contextWindow = Number.isFinite(parsedContextWindow) && parsedContextWindow > 0 ? parsedContextWindow : undefined

  return {
    resolvedModel,
    usedFallback,
    attemptedModelRefs: attemptedModelRefs && attemptedModelRefs.length > 0 ? attemptedModelRefs : undefined,
    contextWindow,
  }
}

async function publishModelResolvedFromHeaders(headers: Headers, context: MuseProxyRuntimeContext): Promise<void> {
  const modelRef = headers.get(MUSE_PROXY_HEADERS.RESOLVED_MODEL)
  if (!modelRef) return

  const meta = extractResponseMeta(headers)

  await context.eventHub.publish(context.sessionId, {
    type: 'model_resolved',
    modelRef,
    task: context.task,
    usedFallback: meta.usedFallback,
    attemptedModelRefs: meta.attemptedModelRefs,
    contextWindow: meta.contextWindow,
  })

  if (context.task === 'chat') {
    await context.sessionStore.updateLastResolvedModel(context.sessionId, {
      modelRef,
      contextWindow: meta.contextWindow,
    })
  }
}

/** 构建 Muse 代理 LLM 请求头（task + selection） */
export function buildMuseProxyRequestHeaders(task: MuseLlmTask, selection?: ModelSelection): Record<string, string> {
  const headers: Record<string, string> = {
    [MUSE_PROXY_HEADERS.TASK]: task,
  }
  if (selection) {
    headers[MUSE_PROXY_HEADERS.SELECTION] = encodeModelSelectionHeader(selection)
  }
  return headers
}

/** 测试用：重置拦截器安装状态 */
export function resetMuseProxyFetchInterceptorForTest(): void {
  interceptorInstalled = false
}
