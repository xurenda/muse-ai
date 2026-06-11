import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  SessionTraceAssistantMessage,
  SessionTraceRequest,
  SessionTraceResponse,
} from '@muse-ai/shared'
import { getTraceDir } from '../data/paths'
import { isRecord } from './read-json-file'

const REQUEST_FILE_NAME = 'request.json'
const RESPONSE_FILE_NAME = 'response.json'

function assertSafeSessionId(sessionId: string): void {
  const trimmed = sessionId.trim()
  if (trimmed.length === 0 || trimmed !== sessionId) {
    throw new Error('无效的 sessionId')
  }
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
    throw new Error('无效的 sessionId')
  }
}

export interface SessionTraceBufferState {
  request?: SessionTraceRequest
  response?: SessionTraceResponse
  updatedAt?: string
  dirty: boolean
}

interface MuseTraceBufferApi {
  updateRequest: (sessionId: string, payload: unknown) => void
  updateResponseStatus: (sessionId: string, status: number) => void
  updateResponseMessage: (sessionId: string, message: unknown) => void
  flush: (sessionId: string) => Promise<void>
}

const buffers = new Map<string, SessionTraceBufferState>()

declare global {
  // eslint-disable-next-line no-var
  var __museTraceBufferApi: MuseTraceBufferApi | undefined
}

function getSessionTraceDir(sessionId: string): string {
  assertSafeSessionId(sessionId)
  return join(getTraceDir(), sessionId)
}

function joinTextSections(...sections: string[]): string {
  return sections.filter((section) => section.trim().length > 0).join('\n')
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

  const toolCalls = content.filter((part) => isRecord(part) && part.type === 'toolCall')
  return toolCalls.length > 0 ? toolCalls : undefined
}

function parseAssistantMessage(message: unknown): SessionTraceAssistantMessage | undefined {
  if (!isRecord(message) || message.role !== 'assistant') {
    return undefined
  }

  const parsed: SessionTraceAssistantMessage = {
    content: message.content,
  }

  const toolCalls = extractToolCalls(message.content)
  if (toolCalls) {
    parsed.toolCalls = toolCalls
  }

  if (isRecord(message.usage)) {
    parsed.usage = message.usage
  }

  if (typeof message.stopReason === 'string') {
    parsed.stopReason = message.stopReason
  }

  return parsed
}

function touchBuffer(sessionId: string): SessionTraceBufferState {
  const current = buffers.get(sessionId) ?? { dirty: false }
  buffers.set(sessionId, current)
  return current
}

export function getSessionTraceBufferState(sessionId: string): SessionTraceBufferState | undefined {
  return buffers.get(sessionId)
}

export function clearSessionTraceBuffer(sessionId: string): void {
  buffers.delete(sessionId)
}

export function traceBufferUpdateRequest(sessionId: string, payload: unknown): void {
  const buffer = touchBuffer(sessionId)
  const capturedAt = new Date().toISOString()
  buffer.request = { payload, capturedAt }
  buffer.updatedAt = capturedAt
  buffer.dirty = true
}

export function traceBufferUpdateResponseStatus(sessionId: string, status: number): void {
  const buffer = touchBuffer(sessionId)
  const capturedAt = new Date().toISOString()
  const previous = buffer.response
  buffer.response = {
    status,
    message: previous?.message ?? { content: null },
    capturedAt,
  }
  buffer.updatedAt = capturedAt
  buffer.dirty = true
}

export function traceBufferUpdateResponseMessage(sessionId: string, message: unknown): void {
  const parsedMessage = parseAssistantMessage(message)
  if (!parsedMessage) {
    return
  }

  const buffer = touchBuffer(sessionId)
  const capturedAt = new Date().toISOString()
  const previous = buffer.response
  buffer.response = {
    status: previous?.status ?? 0,
    thinking: extractThinking(parsedMessage.content),
    message: parsedMessage,
    capturedAt,
  }
  buffer.updatedAt = capturedAt
  buffer.dirty = true
}

export async function flushSessionTraceBuffer(sessionId: string): Promise<void> {
  const buffer = buffers.get(sessionId)
  if (!buffer?.dirty) {
    return
  }

  const traceDir = getSessionTraceDir(sessionId)
  await mkdir(traceDir, { recursive: true })

  if (buffer.request) {
    await writeFile(join(traceDir, REQUEST_FILE_NAME), `${JSON.stringify(buffer.request, null, 2)}\n`, 'utf8')
  }

  if (buffer.response) {
    await writeFile(join(traceDir, RESPONSE_FILE_NAME), `${JSON.stringify(buffer.response, null, 2)}\n`, 'utf8')
  }

  buffer.dirty = false
}

export async function flushAllSessionTraceBuffers(): Promise<void> {
  await Promise.all([...buffers.keys()].map((sessionId) => flushSessionTraceBuffer(sessionId)))
}

/** 供 trace 插件通过 globalThis 调用，避免插件依赖 core 包 */
export function registerMuseTraceBufferApi(): void {
  globalThis.__museTraceBufferApi = {
    updateRequest: traceBufferUpdateRequest,
    updateResponseStatus: traceBufferUpdateResponseStatus,
    updateResponseMessage: traceBufferUpdateResponseMessage,
    flush: flushSessionTraceBuffer,
  }
}
