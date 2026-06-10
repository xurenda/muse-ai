import type { IncomingMessage, ServerResponse } from 'node:http'
import type {
  CreateSessionRequest,
  DaemonHealthResponse,
  DaemonInfoResponse,
  DaemonState,
  SessionPromptRequest,
} from '@muse-ai/shared'
import { sessionManager } from '../core/session-manager'
import { handleSettingsRoute } from './routes/settings'
import { readJsonBody } from './read-body'

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(body))
}

function sendError(response: ServerResponse, statusCode: number, message: string): void {
  sendJson(response, statusCode, { error: message })
}

function getHealthResponse(): DaemonHealthResponse {
  return { status: 'ok' }
}

function getInfoResponse(state: DaemonState): DaemonInfoResponse {
  const startedAtMs = Date.parse(state.startedAt)
  const uptimeMs = Number.isNaN(startedAtMs) ? 0 : Date.now() - startedAtMs

  return {
    ...state,
    uptimeMs,
  }
}

const SESSION_EVENTS_PATTERN = /^\/sessions\/([^/]+)\/events$/
const SESSION_PROMPT_PATTERN = /^\/sessions\/([^/]+)\/prompt$/
const SESSION_DETAIL_PATTERN = /^\/sessions\/([^/]+)$/

export function createHttpHandler(state: DaemonState) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const method = request.method ?? 'GET'
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname

    try {
      if (method === 'GET' && pathname === '/health') {
        sendJson(response, 200, getHealthResponse())
        return
      }

      if (method === 'GET' && pathname === '/info') {
        sendJson(response, 200, getInfoResponse(state))
        return
      }

      const handledSettings = await handleSettingsRoute(
        method,
        pathname,
        request,
        response,
        sendJson,
        sendError,
      )
      if (handledSettings) {
        return
      }

      if (method === 'POST' && pathname === '/sessions') {
        const body = await readJsonBody<CreateSessionRequest>(request)
        const session = await sessionManager.createSession(body)
        sendJson(response, 201, { session })
        return
      }

      const sessionDetailMatch = pathname.match(SESSION_DETAIL_PATTERN)
      if (method === 'GET' && sessionDetailMatch) {
        const sessionId = sessionDetailMatch[1]
        const detail = sessionManager.getSessionResponse(sessionId)
        if (!detail) {
          sendError(response, 404, '会话不存在')
          return
        }
        sendJson(response, 200, detail)
        return
      }

      const promptMatch = pathname.match(SESSION_PROMPT_PATTERN)
      if (method === 'POST' && promptMatch) {
        const sessionId = promptMatch[1]
        const body = await readJsonBody<SessionPromptRequest>(request)
        if (!body.message?.trim()) {
          sendError(response, 400, 'message 不能为空')
          return
        }

        try {
          await sessionManager.prompt(sessionId, body.message)
          sendJson(response, 202, { accepted: true })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          const statusCode = message.includes('不存在') ? 404 : message.includes('正在回复') ? 409 : 500
          sendError(response, statusCode, message)
        }
        return
      }

      if (pathname.match(SESSION_EVENTS_PATTERN)) {
        sendError(response, 426, '请使用 WebSocket 连接此路径')
        return
      }

      sendError(response, 404, 'Not Found')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      sendError(response, 400, message)
    }
  }
}
