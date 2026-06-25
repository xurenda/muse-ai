import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { GetSessionLlmInspectResponse, SessionLlmInspectRequest, SessionLlmInspectResponse } from '@museai/shared'
import type { MuseLlmTask } from '@museai/shared'
import {
  clearSessionLlmInspectBuffer,
  flushAllSessionLlmInspectBuffers,
  flushSessionLlmInspectBuffer,
  getSessionLlmInspectBufferState,
  getSessionLlmInspectDir,
} from './llm-inspect-buffer.js'

const REQUEST_FILE_NAME = 'request.json'
const RESPONSE_FILE_NAME = 'response.json'

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

function getSessionLlmInspectDiskDir(sessionId: string): string {
  assertSafeSessionId(sessionId)
  return getSessionLlmInspectDir(sessionId)
}

async function readJsonFile(path: string): Promise<unknown> {
  const raw = await readFile(path, 'utf8')
  return JSON.parse(raw) as unknown
}

function parseMuseLlmTask(value: unknown): MuseLlmTask | undefined {
  if (value !== 'chat' && value !== 'compaction' && value !== 'titleGeneration') {
    return undefined
  }
  return value
}

function parseSessionLlmInspectRequest(value: unknown): SessionLlmInspectRequest | undefined {
  if (!isRecord(value) || typeof value.capturedAt !== 'string') {
    return undefined
  }

  const task = parseMuseLlmTask(value.task)
  if (!task) {
    return undefined
  }

  return {
    task,
    payload: value.payload,
    capturedAt: value.capturedAt,
  }
}

function parseSessionLlmInspectResponse(value: unknown): SessionLlmInspectResponse | undefined {
  if (!isRecord(value) || typeof value.status !== 'number' || typeof value.capturedAt !== 'string') {
    return undefined
  }

  if (!isRecord(value.message)) {
    return undefined
  }

  const message: SessionLlmInspectResponse['message'] = {
    content: value.message.content,
  }

  if (Array.isArray(value.message.toolCalls)) {
    message.toolCalls = value.message.toolCalls
  }

  if (Array.isArray(value.message.toolResults)) {
    message.toolResults = value.message.toolResults
  }

  if (isRecord(value.message.usage)) {
    message.usage = value.message.usage
  }

  if (typeof value.message.stopReason === 'string') {
    message.stopReason = value.message.stopReason
  }

  if (typeof value.message.errorMessage === 'string') {
    message.errorMessage = value.message.errorMessage
  }

  const parsed: SessionLlmInspectResponse = {
    status: value.status,
    message,
    capturedAt: value.capturedAt,
  }

  if (typeof value.thinking === 'string') {
    parsed.thinking = value.thinking
  }

  if (typeof value.resolvedModel === 'string') {
    parsed.resolvedModel = value.resolvedModel
  }

  if (typeof value.usedFallback === 'boolean') {
    parsed.usedFallback = value.usedFallback
  }

  if (Array.isArray(value.attemptedModelRefs)) {
    parsed.attemptedModelRefs = value.attemptedModelRefs.filter((ref): ref is string => typeof ref === 'string')
  }

  if (typeof value.contextWindow === 'number') {
    parsed.contextWindow = value.contextWindow
  }

  return parsed
}

async function readSessionLlmInspectFromDisk(sessionId: string): Promise<{
  request?: SessionLlmInspectRequest
  response?: SessionLlmInspectResponse
  updatedAt?: string
}> {
  const inspectDir = getSessionLlmInspectDiskDir(sessionId)
  let request: SessionLlmInspectRequest | undefined
  let response: SessionLlmInspectResponse | undefined
  let updatedAt: string | undefined

  try {
    const requestRaw = await readJsonFile(join(inspectDir, REQUEST_FILE_NAME))
    request = parseSessionLlmInspectRequest(requestRaw)
    if (request) {
      updatedAt = request.capturedAt
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }

  try {
    const responseRaw = await readJsonFile(join(inspectDir, RESPONSE_FILE_NAME))
    response = parseSessionLlmInspectResponse(responseRaw)
    if (response) {
      updatedAt = response.capturedAt
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }

  if (request && response) {
    updatedAt = request.capturedAt > response.capturedAt ? request.capturedAt : response.capturedAt
  }

  return { request, response, updatedAt }
}

export async function getSessionLlmInspect(sessionId: string): Promise<GetSessionLlmInspectResponse> {
  const buffer = getSessionLlmInspectBufferState(sessionId)
  if (buffer && (buffer.request || buffer.response)) {
    return {
      sessionId,
      request: buffer.request,
      response: buffer.response,
      updatedAt: buffer.updatedAt,
    }
  }

  const disk = await readSessionLlmInspectFromDisk(sessionId)
  return {
    sessionId,
    request: disk.request,
    response: disk.response,
    updatedAt: disk.updatedAt,
  }
}

/** 删除会话 llm-inspect 目录与内存缓冲 */
export async function deleteSessionLlmInspect(sessionId: string): Promise<void> {
  clearSessionLlmInspectBuffer(sessionId)
  const inspectDir = getSessionLlmInspectDiskDir(sessionId)
  await rm(inspectDir, { recursive: true, force: true })
}

export { flushAllSessionLlmInspectBuffers, flushSessionLlmInspectBuffer }
