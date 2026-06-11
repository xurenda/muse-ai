import type { ServerResponse } from 'node:http'
import { sessionManager } from '../../core/session-manager'
import { getSessionTrace, listSessionTraces, parseTurnIndexParam } from '../../core/trace-store'

type SendJson = (response: ServerResponse, statusCode: number, body: unknown) => void
type SendError = (response: ServerResponse, statusCode: number, message: string) => void

const SESSION_TRACES_PATTERN = /^\/sessions\/([^/]+)\/traces$/
const SESSION_TRACE_DETAIL_PATTERN = /^\/sessions\/([^/]+)\/traces\/(\d+)$/

function mapTraceError(message: string): number {
  if (message.includes('不存在') || message.includes('无效')) {
    return message.includes('会话不存在') ? 404 : 400
  }
  if (message === 'trace 不存在') {
    return 404
  }
  return 500
}

export async function handleTracesRoute(
  method: string,
  pathname: string,
  response: ServerResponse,
  sendJson: SendJson,
  sendError: SendError,
): Promise<boolean> {
  const listMatch = pathname.match(SESSION_TRACES_PATTERN)
  if (method === 'GET' && listMatch) {
    const sessionId = listMatch[1]
    try {
      if (!sessionManager.hasSession(sessionId)) {
        sendError(response, 404, '会话不存在')
        return true
      }
      sendJson(response, 200, await listSessionTraces(sessionId))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      sendError(response, mapTraceError(message), message)
    }
    return true
  }

  const detailMatch = pathname.match(SESSION_TRACE_DETAIL_PATTERN)
  if (method === 'GET' && detailMatch) {
    const sessionId = detailMatch[1]
    try {
      if (!sessionManager.hasSession(sessionId)) {
        sendError(response, 404, '会话不存在')
        return true
      }
      const turnIndex = parseTurnIndexParam(detailMatch[2] ?? '')
      sendJson(response, 200, await getSessionTrace(sessionId, turnIndex))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      sendError(response, mapTraceError(message), message)
    }
    return true
  }

  return false
}
