import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { SessionLlmInspectAssistantMessage, SessionLlmInspectRequest, SessionLlmInspectResponse } from '@museai/shared'
import type { MuseLlmTask } from '@museai/shared'
import { getLlmInspectDir } from '@/paths.js'

const REQUEST_FILE_NAME = 'request.json'
const RESPONSE_FILE_NAME = 'response.json'

/** 调试面板采集的 task；titleGeneration 等后台任务会覆盖 chat 快照，故排除 */
export function shouldCaptureLlmInspectTask(task: MuseLlmTask): boolean {
  return task === 'chat' || task === 'compaction'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertSafeSessionId(sessionId: string): void {
  const trimmed = sessionId.trim()
  if (trimmed.length === 0 || trimmed !== sessionId) {
    throw new Error('无效的 sessionId')
  }
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
    throw new Error('无效的 sessionId')
  }
}

export interface SessionLlmInspectBufferState {
  request?: SessionLlmInspectRequest
  response?: SessionLlmInspectResponse
  updatedAt?: string
  dirty: boolean
}

const buffers = new Map<string, SessionLlmInspectBufferState>()

function getSessionLlmInspectDir(sessionId: string): string {
  assertSafeSessionId(sessionId)
  return join(getLlmInspectDir(), sessionId)
}

function joinTextSections(...sections: string[]): string {
  return sections.filter(section => section.trim().length > 0).join('\n')
}

function extractThinking(content: unknown): string | undefined {
  if (!Array.isArray(content)) {
    return undefined
  }

  const parts: string[] = []
  for (const part of content) {
    if (!isRecord(part) || part.type !== 'thinking' || typeof part.thinking !== 'string') {
      continue
    }
    parts.push(part.thinking)
  }

  const thinking = joinTextSections(...parts)
  return thinking.length > 0 ? thinking : undefined
}

function extractToolCalls(content: unknown): unknown[] | undefined {
  if (!Array.isArray(content)) {
    return undefined
  }

  const toolCalls = content.filter(part => isRecord(part) && part.type === 'toolCall')
  return toolCalls.length > 0 ? toolCalls : undefined
}

function parseAssistantMessage(message: unknown, toolResults?: unknown[]): SessionLlmInspectAssistantMessage | undefined {
  if (!isRecord(message) || message.role !== 'assistant') {
    return undefined
  }

  const parsed: SessionLlmInspectAssistantMessage = {
    content: message.content,
  }

  const toolCalls = extractToolCalls(message.content)
  if (toolCalls) {
    parsed.toolCalls = toolCalls
  }

  if (toolResults && toolResults.length > 0) {
    parsed.toolResults = toolResults
  }

  if (isRecord(message.usage)) {
    parsed.usage = message.usage
  }

  if (typeof message.stopReason === 'string') {
    parsed.stopReason = message.stopReason
  }

  if (typeof message.errorMessage === 'string') {
    parsed.errorMessage = message.errorMessage
  }

  return parsed
}

function touchBuffer(sessionId: string): SessionLlmInspectBufferState {
  const current = buffers.get(sessionId) ?? { dirty: false }
  buffers.set(sessionId, current)
  return current
}

export function getSessionLlmInspectBufferState(sessionId: string): SessionLlmInspectBufferState | undefined {
  return buffers.get(sessionId)
}

export function clearSessionLlmInspectBuffer(sessionId: string): void {
  buffers.delete(sessionId)
}

export function llmInspectBufferUpdateRequest(sessionId: string, task: MuseLlmTask, payload: unknown): void {
  if (!shouldCaptureLlmInspectTask(task)) {
    return
  }
  const buffer = touchBuffer(sessionId)
  const capturedAt = new Date().toISOString()
  buffer.request = { task, payload, capturedAt }
  buffer.updatedAt = capturedAt
  buffer.dirty = true
}

export interface LlmInspectResponseMeta {
  resolvedModel?: string
  usedFallback?: boolean
  attemptedModelRefs?: string[]
  contextWindow?: number
}

function hasCapturableInspectRequest(buffer: SessionLlmInspectBufferState | undefined): buffer is SessionLlmInspectBufferState & {
  request: SessionLlmInspectRequest
} {
  return buffer?.request !== undefined && shouldCaptureLlmInspectTask(buffer.request.task)
}

export function llmInspectBufferUpdateResponseStatus(sessionId: string, status: number, meta?: LlmInspectResponseMeta): void {
  const buffer = buffers.get(sessionId)
  if (!hasCapturableInspectRequest(buffer)) {
    return
  }

  const capturedAt = new Date().toISOString()
  const previous = buffer.response
  buffer.response = {
    status,
    resolvedModel: meta?.resolvedModel ?? previous?.resolvedModel,
    usedFallback: meta?.usedFallback ?? previous?.usedFallback,
    attemptedModelRefs: meta?.attemptedModelRefs ?? previous?.attemptedModelRefs,
    contextWindow: meta?.contextWindow ?? previous?.contextWindow,
    message: previous?.message ?? { content: null },
    capturedAt,
  }
  buffer.updatedAt = capturedAt
  buffer.dirty = true
}

export function llmInspectBufferUpdateResponseMessage(sessionId: string, message: unknown, toolResults?: unknown[]): void {
  const parsedMessage = parseAssistantMessage(message, toolResults)
  if (!parsedMessage) {
    return
  }

  const buffer = buffers.get(sessionId)
  if (!hasCapturableInspectRequest(buffer)) {
    return
  }

  const capturedAt = new Date().toISOString()
  const previous = buffer.response
  buffer.response = {
    status: previous?.status ?? 0,
    resolvedModel: previous?.resolvedModel,
    usedFallback: previous?.usedFallback,
    attemptedModelRefs: previous?.attemptedModelRefs,
    contextWindow: previous?.contextWindow,
    thinking: extractThinking(parsedMessage.content),
    message: parsedMessage,
    capturedAt,
  }
  buffer.updatedAt = capturedAt
  buffer.dirty = true
}

/** 非流式 completion JSON 中提取 assistant 消息 */
export function llmInspectBufferUpdateResponseFromCompletionJson(sessionId: string, body: unknown): void {
  if (!isRecord(body) || !Array.isArray(body.choices) || body.choices.length === 0) {
    return
  }

  const choice = body.choices[0]
  if (!isRecord(choice) || !isRecord(choice.message)) {
    return
  }

  llmInspectBufferUpdateResponseMessage(sessionId, choice.message)
}

export async function flushSessionLlmInspectBuffer(sessionId: string): Promise<void> {
  const buffer = buffers.get(sessionId)
  if (!buffer?.dirty) {
    return
  }

  const inspectDir = getSessionLlmInspectDir(sessionId)
  await mkdir(inspectDir, { recursive: true })

  if (buffer.request) {
    await writeFile(join(inspectDir, REQUEST_FILE_NAME), `${JSON.stringify(buffer.request, null, 2)}\n`, 'utf8')
  }

  if (buffer.response) {
    await writeFile(join(inspectDir, RESPONSE_FILE_NAME), `${JSON.stringify(buffer.response, null, 2)}\n`, 'utf8')
  }

  buffer.dirty = false
}

export async function flushAllSessionLlmInspectBuffers(): Promise<void> {
  await Promise.all([...buffers.keys()].map(sessionId => flushSessionLlmInspectBuffer(sessionId)))
}

export { getSessionLlmInspectDir }
