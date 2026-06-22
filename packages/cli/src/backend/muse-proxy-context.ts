import { AsyncLocalStorage } from 'node:async_hooks'
import { encodeModelSelectionHeader, MUSE_PROXY_HEADERS, type ModelSelection, type MuseLlmTask } from '@muse-ai/shared'
import type { MuseSessionStore } from '@muse-ai/core'
import type { SessionEventHub } from '@/daemon/event-hub.js'

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

/** 安装全局 fetch 拦截：读取 LLM 代理响应头并发布 model_resolved */
export function installMuseProxyFetchInterceptor(backendUrl: string): void {
  if (interceptorInstalled) return
  interceptorInstalled = true

  const base = backendUrl.replace(/\/$/, '')
  const prefix = `${base}/v1`
  const originalFetch = globalThis.fetch.bind(globalThis)

  globalThis.fetch = async (input: Parameters<typeof originalFetch>[0], init?: RequestInit): Promise<Response> => {
    const response = await originalFetch(input, init)
    const url = resolveFetchUrl(input)
    if (url.startsWith(prefix)) {
      const context = museProxyContextStorage.getStore()
      if (context) {
        await publishModelResolvedFromHeaders(response.headers, context)
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

async function publishModelResolvedFromHeaders(headers: Headers, context: MuseProxyRuntimeContext): Promise<void> {
  const modelRef = headers.get(MUSE_PROXY_HEADERS.RESOLVED_MODEL)
  if (!modelRef) return

  const usedFallback = headers.get(MUSE_PROXY_HEADERS.FALLBACK_USED) === 'true'
  const attemptedHeader = headers.get(MUSE_PROXY_HEADERS.ATTEMPTED_MODELS)
  const attemptedModelRefs = attemptedHeader
    ? attemptedHeader
        .split(',')
        .map(ref => ref.trim())
        .filter(ref => ref.length > 0)
    : undefined

  await context.eventHub.publish(context.sessionId, {
    type: 'model_resolved',
    modelRef,
    task: context.task,
    usedFallback: usedFallback || undefined,
    attemptedModelRefs: attemptedModelRefs && attemptedModelRefs.length > 0 ? attemptedModelRefs : undefined,
  })

  if (context.task === 'chat') {
    await context.sessionStore.updateLastResolvedModelRef(context.sessionId, modelRef)
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
