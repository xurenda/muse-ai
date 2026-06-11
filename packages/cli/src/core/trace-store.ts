import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { GetSessionTraceResponse, ListSessionTracesResponse, LlmTraceEntry } from '@muse-ai/shared'
import { getTraceDir } from '../data/paths'
import { isRecord } from './read-json-file'

const TRACE_FILE_PATTERN = /^(\d+)-trace\.jsonl$/

export function assertSafeSessionId(sessionId: string): void {
  const trimmed = sessionId.trim()
  if (trimmed.length === 0 || trimmed !== sessionId) {
    throw new Error('无效的 sessionId')
  }
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
    throw new Error('无效的 sessionId')
  }
}

export function parseTurnIndexParam(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error('无效的 turnIndex')
  }
  const turnIndex = Number.parseInt(value, 10)
  if (!Number.isInteger(turnIndex) || turnIndex < 0) {
    throw new Error('无效的 turnIndex')
  }
  return turnIndex
}

function getSessionTraceDir(sessionId: string): string {
  assertSafeSessionId(sessionId)
  return join(getTraceDir(), sessionId)
}

function parseTraceLine(line: string, lineNumber: number, filePath: string): LlmTraceEntry | null {
  const trimmed = line.trim()
  if (trimmed.length === 0) {
    return null
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed) as unknown
  } catch {
    throw new Error(`${filePath}:${lineNumber} 不是合法 JSON`)
  }

  if (!isRecord(parsed)) {
    throw new Error(`${filePath}:${lineNumber} 格式无效`)
  }

  const { timestamp, turnIndex, type } = parsed
  if (typeof timestamp !== 'string' || typeof type !== 'string') {
    throw new Error(`${filePath}:${lineNumber} 缺少 timestamp 或 type`)
  }
  if (typeof turnIndex !== 'number' || !Number.isInteger(turnIndex) || turnIndex < 0) {
    throw new Error(`${filePath}:${lineNumber} 缺少有效的 turnIndex`)
  }

  const entry: LlmTraceEntry = {
    timestamp,
    turnIndex,
    type,
  }

  if (typeof parsed.systemPrompt === 'string') {
    entry.systemPrompt = parsed.systemPrompt
  }
  if (isRecord(parsed.model)) {
    entry.model = parsed.model
  }
  if ('payload' in parsed) {
    entry.payload = parsed.payload
  }
  if (typeof parsed.status === 'number') {
    entry.status = parsed.status
  }
  if (isRecord(parsed.headers)) {
    const headers: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed.headers)) {
      if (typeof value === 'string') {
        headers[key] = value
      }
    }
    entry.headers = headers
  }
  if (typeof parsed.messageRole === 'string') {
    entry.messageRole = parsed.messageRole
  }
  if (typeof parsed.toolResultCount === 'number') {
    entry.toolResultCount = parsed.toolResultCount
  }

  return entry
}

async function readTraceFile(filePath: string): Promise<LlmTraceEntry[]> {
  let raw: string
  try {
    raw = await readFile(filePath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw error
  }

  const entries: LlmTraceEntry[] = []
  const lines = raw.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const entry = parseTraceLine(lines[index] ?? '', index + 1, filePath)
    if (entry) {
      entries.push(entry)
    }
  }
  return entries
}

function readModelLabel(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }
  if (!isRecord(value)) {
    return undefined
  }

  for (const key of ['id', 'model', 'name'] as const) {
    const candidate = value[key]
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim()
    }
  }

  return undefined
}

function extractModelLabel(entries: LlmTraceEntry[]): string | undefined {
  for (const entry of entries) {
    if (entry.type !== 'provider_request') {
      continue
    }

    const fromEntryModel = entry.model ? readModelLabel(entry.model) : undefined
    if (fromEntryModel) {
      return fromEntryModel
    }

    if (isRecord(entry.payload)) {
      const fromPayloadModel = readModelLabel(entry.payload.model)
      if (fromPayloadModel) {
        return fromPayloadModel
      }
    }
  }

  return undefined
}

export async function listSessionTraces(sessionId: string): Promise<ListSessionTracesResponse> {
  const traceDir = getSessionTraceDir(sessionId)
  let files: string[]
  try {
    files = await readdir(traceDir)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { sessionId, traces: [] }
    }
    throw error
  }

  const summaries = await Promise.all(
    files.map(async (fileName) => {
      const match = fileName.match(TRACE_FILE_PATTERN)
      if (!match) {
        return null
      }

      const turnIndex = Number.parseInt(match[1] ?? '', 10)
      const filePath = join(traceDir, fileName)
      const [entries, fileStat] = await Promise.all([readTraceFile(filePath), stat(filePath)])

      return {
        turnIndex,
        entryCount: entries.length,
        updatedAt: fileStat.mtime.toISOString(),
        modelLabel: extractModelLabel(entries),
      }
    }),
  )

  const traces = summaries
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((left, right) => left.turnIndex - right.turnIndex)

  return { sessionId, traces }
}

export async function getSessionTrace(sessionId: string, turnIndex: number): Promise<GetSessionTraceResponse> {
  const traceDir = getSessionTraceDir(sessionId)
  const filePath = join(traceDir, `${turnIndex}-trace.jsonl`)
  const entries = await readTraceFile(filePath)

  if (entries.length === 0) {
    try {
      await stat(filePath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error('trace 不存在')
      }
      throw error
    }
  }

  return {
    sessionId,
    turnIndex,
    entries,
  }
}
