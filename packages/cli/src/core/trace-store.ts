import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  GetSessionTraceResponse,
  SessionTraceRequest,
  SessionTraceResponse,
} from '@muse-ai/shared'
import { getTraceDir } from '../data/paths'
import {
  clearSessionTraceBuffer,
  flushAllSessionTraceBuffers,
  flushSessionTraceBuffer,
  getSessionTraceBufferState,
} from './trace-buffer'
import { isRecord } from './read-json-file'

const REQUEST_FILE_NAME = 'request.json'
const RESPONSE_FILE_NAME = 'response.json'

export function assertSafeSessionId(sessionId: string): void {
  const trimmed = sessionId.trim()
  if (trimmed.length === 0 || trimmed !== sessionId) {
    throw new Error('无效的 sessionId')
  }
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
    throw new Error('无效的 sessionId')
  }
}

function getSessionTraceDir(sessionId: string): string {
  assertSafeSessionId(sessionId)
  return join(getTraceDir(), sessionId)
}

async function readJsonFile(path: string): Promise<unknown> {
  const raw = await readFile(path, 'utf8')
  return JSON.parse(raw) as unknown
}

function parseSessionTraceRequest(value: unknown): SessionTraceRequest | undefined {
  if (!isRecord(value) || typeof value.capturedAt !== 'string') {
    return undefined
  }

  return {
    payload: value.payload,
    capturedAt: value.capturedAt,
  }
}

function parseSessionTraceResponse(value: unknown): SessionTraceResponse | undefined {
  if (!isRecord(value) || typeof value.status !== 'number' || typeof value.capturedAt !== 'string') {
    return undefined
  }

  if (!isRecord(value.message)) {
    return undefined
  }

  const message: SessionTraceResponse['message'] = {
    content: value.message.content,
  }

  if (Array.isArray(value.message.toolCalls)) {
    message.toolCalls = value.message.toolCalls
  }

  if (isRecord(value.message.usage)) {
    message.usage = value.message.usage
  }

  if (typeof value.message.stopReason === 'string') {
    message.stopReason = value.message.stopReason
  }

  const parsed: SessionTraceResponse = {
    status: value.status,
    message,
    capturedAt: value.capturedAt,
  }

  if (typeof value.thinking === 'string') {
    parsed.thinking = value.thinking
  }

  return parsed
}

async function readSessionTraceFromDisk(sessionId: string): Promise<{
  request?: SessionTraceRequest
  response?: SessionTraceResponse
  updatedAt?: string
}> {
  const traceDir = getSessionTraceDir(sessionId)
  let request: SessionTraceRequest | undefined
  let response: SessionTraceResponse | undefined
  let updatedAt: string | undefined

  try {
    const requestRaw = await readJsonFile(join(traceDir, REQUEST_FILE_NAME))
    request = parseSessionTraceRequest(requestRaw)
    if (request) {
      updatedAt = request.capturedAt
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }

  try {
    const responseRaw = await readJsonFile(join(traceDir, RESPONSE_FILE_NAME))
    response = parseSessionTraceResponse(responseRaw)
    if (response) {
      updatedAt = response.capturedAt
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }

  if (request && response) {
    updatedAt =
      request.capturedAt > response.capturedAt ? request.capturedAt : response.capturedAt
  }

  return { request, response, updatedAt }
}

export async function getSessionTrace(sessionId: string): Promise<GetSessionTraceResponse> {
  const buffer = getSessionTraceBufferState(sessionId)
  if (buffer && (buffer.request || buffer.response)) {
    return {
      sessionId,
      request: buffer.request,
      response: buffer.response,
      updatedAt: buffer.updatedAt,
    }
  }

  const disk = await readSessionTraceFromDisk(sessionId)
  return {
    sessionId,
    request: disk.request,
    response: disk.response,
    updatedAt: disk.updatedAt,
  }
}

/** 删除会话 trace 目录与内存缓冲 */
export async function deleteSessionTraces(sessionId: string): Promise<void> {
  clearSessionTraceBuffer(sessionId)
  const traceDir = getSessionTraceDir(sessionId)
  await rm(traceDir, { recursive: true, force: true })
}

export { flushAllSessionTraceBuffers, flushSessionTraceBuffer }
