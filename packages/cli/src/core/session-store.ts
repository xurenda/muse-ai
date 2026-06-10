import { appendFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AgentMessage } from '@earendil-works/pi-agent-core'
import type { SessionMeta, SessionTranscriptMessageEntry } from '@muse-ai/shared'
import { getAgentSessionsDir, getSessionsDir } from '../data/paths'
import { isRecord } from './read-json-file'

const SESSION_META_SUFFIX = '.meta.json'
const SESSION_TRANSCRIPT_SUFFIX = '.jsonl'

export function getSessionMetaPath(agentId: string, sessionId: string): string {
  return join(getAgentSessionsDir(agentId), `${sessionId}${SESSION_META_SUFFIX}`)
}

export function getSessionTranscriptPath(agentId: string, sessionId: string): string {
  return join(getAgentSessionsDir(agentId), `${sessionId}${SESSION_TRANSCRIPT_SUFFIX}`)
}

function parseSessionMeta(value: unknown, filePath: string): SessionMeta {
  if (!isRecord(value)) {
    throw new Error(`${filePath} 格式无效：期望对象`)
  }

  const { id, agentId, cwd, title, createdAt, updatedAt, messageCount } = value
  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new Error(`${filePath} 缺少有效的 id`)
  }
  if (typeof agentId !== 'string' || agentId.trim().length === 0) {
    throw new Error(`${filePath} 缺少有效的 agentId`)
  }
  if (typeof createdAt !== 'string' || createdAt.trim().length === 0) {
    throw new Error(`${filePath} 缺少有效的 createdAt`)
  }

  return {
    id: id.trim(),
    agentId: agentId.trim(),
    cwd: typeof cwd === 'string' ? cwd : undefined,
    title: typeof title === 'string' ? title : undefined,
    createdAt,
    updatedAt: typeof updatedAt === 'string' ? updatedAt : undefined,
    messageCount: typeof messageCount === 'number' ? messageCount : undefined,
  }
}

function isAgentMessage(value: unknown): value is AgentMessage {
  return isRecord(value) && typeof value.role === 'string'
}

function parseTranscriptLine(line: string, lineNumber: number, filePath: string): SessionTranscriptMessageEntry | null {
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
    return null
  }

  if (parsed.type === 'message') {
    if (typeof parsed.timestamp !== 'string') {
      throw new Error(`${filePath}:${lineNumber} 缺少 timestamp`)
    }
    if (!isAgentMessage(parsed.message)) {
      throw new Error(`${filePath}:${lineNumber} 缺少有效 message`)
    }
    return {
      type: 'message',
      timestamp: parsed.timestamp,
      message: parsed.message,
    }
  }

  // 兼容旧版 transcript：{ role, text, message }
  if (isAgentMessage(parsed.message)) {
    return {
      type: 'message',
      timestamp: typeof parsed.timestamp === 'string' ? parsed.timestamp : new Date(0).toISOString(),
      message: parsed.message,
    }
  }

  if (isAgentMessage(parsed)) {
    return {
      type: 'message',
      timestamp: new Date(0).toISOString(),
      message: parsed,
    }
  }

  return null
}

export async function readSessionMeta(agentId: string, sessionId: string): Promise<SessionMeta | null> {
  const metaPath = getSessionMetaPath(agentId, sessionId)
  try {
    const raw = await readFile(metaPath, 'utf8')
    return parseSessionMeta(JSON.parse(raw) as unknown, metaPath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw error
  }
}

export async function writeSessionMeta(meta: SessionMeta): Promise<void> {
  const dir = getAgentSessionsDir(meta.agentId)
  await mkdir(dir, { recursive: true })
  await writeFile(getSessionMetaPath(meta.agentId, meta.id), `${JSON.stringify(meta, null, 2)}\n`, 'utf8')
}

export async function readSessionMessages(agentId: string, sessionId: string): Promise<AgentMessage[]> {
  const transcriptPath = getSessionTranscriptPath(agentId, sessionId)
  let raw: string
  try {
    raw = await readFile(transcriptPath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw error
  }

  const messages: AgentMessage[] = []
  const lines = raw.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const entry = parseTranscriptLine(lines[index] ?? '', index + 1, transcriptPath)
    if (!entry) {
      continue
    }
    messages.push(entry.message as AgentMessage)
  }
  return messages
}

function formatTranscriptLines(messages: AgentMessage[], timestamp: string): string[] {
  return messages.map((message) =>
    JSON.stringify({
      type: 'message',
      timestamp,
      message,
    } satisfies SessionTranscriptMessageEntry),
  )
}

/** 追加新消息到 transcript（append-only） */
export async function appendSessionTranscriptEntries(
  agentId: string,
  sessionId: string,
  messages: AgentMessage[],
): Promise<void> {
  if (messages.length === 0) {
    return
  }

  const dir = getAgentSessionsDir(agentId)
  await mkdir(dir, { recursive: true })
  const timestamp = new Date().toISOString()
  const content = `${formatTranscriptLines(messages, timestamp).join('\n')}\n`
  await appendFile(getSessionTranscriptPath(agentId, sessionId), content, 'utf8')
}

export async function deleteSessionFiles(agentId: string, sessionId: string): Promise<void> {
  await Promise.all([
    rm(getSessionMetaPath(agentId, sessionId), { force: true }),
    rm(getSessionTranscriptPath(agentId, sessionId), { force: true }),
  ])
}

/** 扫描 ~/.muse/sessions/ 下全部 session 元数据（不加载 transcript） */
export async function scanSessionMetas(): Promise<SessionMeta[]> {
  const sessionsRoot = getSessionsDir()
  let agentEntries: string[]
  try {
    agentEntries = await readdir(sessionsRoot)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw error
  }

  const metas: SessionMeta[] = []
  for (const agentId of agentEntries) {
    const agentDir = join(sessionsRoot, agentId)
    let files: string[]
    try {
      files = await readdir(agentDir)
    } catch {
      continue
    }

    for (const fileName of files) {
      if (!fileName.endsWith(SESSION_META_SUFFIX)) {
        continue
      }
      const sessionId = fileName.slice(0, -SESSION_META_SUFFIX.length)
      const meta = await readSessionMeta(agentId, sessionId)
      if (meta) {
        metas.push(meta)
      }
    }
  }

  return metas.sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt ?? left.createdAt)
    const rightTime = Date.parse(right.updatedAt ?? right.createdAt)
    return rightTime - leftTime
  })
}
