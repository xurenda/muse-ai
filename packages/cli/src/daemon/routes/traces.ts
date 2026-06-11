import type { IncomingMessage, ServerResponse } from 'node:http'
import { sessionManager } from '../../core/session-manager'
import { computeSessionTraceETag, matchesIfNoneMatch } from '../../core/trace-etag'
import { getSessionTrace } from '../../core/trace-store'

type SendError = (response: ServerResponse, statusCode: number, message: string) => void

const SESSION_TRACE_PATTERN = /^\/sessions\/([^/]+)\/trace$/

function mapTraceError(message: string): number {
  if (message.includes('不存在') || message.includes('无效')) {
    return message.includes('会话不存在') ? 404 : 400
  }
  return 500
}

export async function handleTracesRoute(
  method: string,
  pathname: string,
  request: IncomingMessage,
  response: ServerResponse,
  _sendJson: (response: ServerResponse, statusCode: number, body: unknown) => void,
  sendError: SendError,
): Promise<boolean> {
  const traceMatch = pathname.match(SESSION_TRACE_PATTERN)
  if (method === 'GET' && traceMatch) {
    const sessionId = traceMatch[1]
    try {
      if (!sessionManager.hasSession(sessionId)) {
        sendError(response, 404, '会话不存在')
        return true
      }

      const body = await getSessionTrace(sessionId)
      const etag = computeSessionTraceETag(body)

      if (matchesIfNoneMatch(request.headers['if-none-match'], etag)) {
        response.writeHead(304, { ETag: etag })
        response.end()
        return true
      }

      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        ETag: etag,
      })
      response.end(JSON.stringify(body))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      sendError(response, mapTraceError(message), message)
    }
    return true
  }

  return false
}
