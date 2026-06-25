import type { ModelSelection, ModelStrategyPools, TaskModelSelection } from '@museai/shared'

export { collectModelRefsFromStrategy, dedupeModelPoolRefs, normalizeModelStrategyPools } from '@museai/shared'

export interface ResolvedModelCandidate {
  modelRef: string
  candidates: readonly string[]
  candidateIndex: number
  usedFallback: boolean
}

/** 展开 selection 为有序 modelRef 候选列表 */
export function expandModelSelection(selection: ModelSelection, pools: ModelStrategyPools): string[] {
  if (selection.type === 'model') {
    return [selection.modelRef]
  }
  return [...pools[selection.tier]]
}

/** 解析任务级 selection（含 follow_chat） */
export function expandTaskModelSelection(taskSelection: TaskModelSelection, chatSelection: ModelSelection, pools: ModelStrategyPools): string[] {
  if (taskSelection.type === 'follow_chat') {
    return expandModelSelection(chatSelection, pools)
  }
  return expandModelSelection(taskSelection, pools)
}

/** 取候选列表中首个 modelRef；池为空时返回 null */
export function resolvePrimaryModelCandidate(selection: ModelSelection, pools: ModelStrategyPools): ResolvedModelCandidate | null {
  const candidates = expandModelSelection(selection, pools)
  const first = candidates[0]
  if (!first) return null
  return {
    modelRef: first,
    candidates,
    candidateIndex: 0,
    usedFallback: false,
  }
}

/** fallback 后取下一个候选；无更多候选时返回 null */
export function resolveNextModelCandidate(current: ResolvedModelCandidate): ResolvedModelCandidate | null {
  const nextIndex = current.candidateIndex + 1
  const nextRef = current.candidates[nextIndex]
  if (!nextRef) return null
  return {
    modelRef: nextRef,
    candidates: current.candidates,
    candidateIndex: nextIndex,
    usedFallback: true,
  }
}

/** 将 preferredRef 置于候选列表首位（仍在列表内时），其余保序 */
export function reorderCandidatesWithPreference(candidates: readonly string[], preferredRef?: string | null): string[] {
  const preferred = preferredRef?.trim()
  if (!preferred || !candidates.includes(preferred)) {
    return [...candidates]
  }
  return [preferred, ...candidates.filter(ref => ref !== preferred)]
}

/** 从 HTTP 响应或 Error 提取状态码 */
export function extractHttpStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined

  if ('status' in error && typeof error.status === 'number') {
    return error.status
  }
  if ('statusCode' in error && typeof error.statusCode === 'number') {
    return error.statusCode
  }

  const response = 'response' in error ? error.response : undefined
  if (typeof response === 'object' && response !== null && 'status' in response && typeof response.status === 'number') {
    return response.status
  }

  return undefined
}

const NON_RETRYABLE_HTTP_STATUSES = new Set([400, 404, 413, 422])

const RETRYABLE_NETWORK_ERROR_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN'])

function isRetryableNetworkErrorCode(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false
  const code = error.code
  return typeof code === 'string' && RETRYABLE_NETWORK_ERROR_CODES.has(code)
}

function isRetryableErrorMessage(message: string): boolean {
  const normalized = message.toLowerCase()
  if (normalized.includes('content policy') || normalized.includes('moderation') || normalized.includes('invalid_request')) {
    return false
  }
  return (
    normalized.includes('timeout') ||
    normalized.includes('timed out') ||
    normalized.includes('econnrefused') ||
    normalized.includes('enotfound') ||
    normalized.includes('network') ||
    normalized.includes('fetch failed') ||
    normalized.includes('rate limit') ||
    normalized.includes('overloaded') ||
    normalized.includes('503') ||
    normalized.includes('429')
  )
}

/** 是否应对 tier 池内下一个模型 retry（对齐 phase-1 决策） */
export function isRetryableModelError(error: unknown): boolean {
  const status = extractHttpStatus(error)
  if (status !== undefined) {
    if (NON_RETRYABLE_HTTP_STATUSES.has(status)) return false
    if (status === 401 || status === 403 || status === 408 || status === 429) return true
    if (status >= 500) return true
    return false
  }

  if (isRetryableNetworkErrorCode(error)) return true

  if (error instanceof Error) {
    const name = error.name
    if (name === 'AbortError' || name === 'TimeoutError') return true

    if (isRetryableErrorMessage(error.message)) return true

    if (error.cause !== undefined && isRetryableModelError(error.cause)) return true
  }

  return false
}
