import type { IncomingMessage, ServerResponse } from 'node:http'
import type {
  CreateSessionRequest,
  DaemonHealthResponse,
  DaemonInfoResponse,
  DaemonState,
  SessionFollowUpRequest,
  SessionPromptRequest,
  SessionSteerRequest,
} from '@muse-ai/shared'
import { sessionManager } from '../core/session-manager'
import { handleSettingsRoute } from './routes/settings'
import { handleTracesRoute } from './routes/traces'
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
const SESSION_ABORT_PATTERN = /^\/sessions\/([^/]+)\/abort$/
const SESSION_STEER_PATTERN = /^\/sessions\/([^/]+)\/steer$/
const SESSION_FOLLOW_UP_PATTERN = /^\/sessions\/([^/]+)\/follow-up$/
const SESSION_DETAIL_PATTERN = /^\/sessions\/([^/]+)$/

function mapSessionCommandError(message: string): number {
  if (message.includes('不存在')) {
    return 404
  }
  if (message.includes('正在回复') || message.includes('没有进行中') || message.includes('尚未开始')) {
    return 409
  }
  return 500
}

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

      const handledTraces = await handleTracesRoute(method, pathname, request, response, sendJson, sendError)
      if (handledTraces) {
        return
      }

      if (method === 'GET' && pathname === '/sessions') {
        const query = new URL(request.url ?? '/', 'http://localhost').searchParams
        const agentId = query.get('agentId') ?? undefined
        sendJson(response, 200, {
          sessions: sessionManager.listSessions(agentId),
        })
        return
      }

      if (method === 'POST' && pathname === '/sessions') {
        const body = await readJsonBody<CreateSessionRequest>(request)
        const session = await sessionManager.createSession(body)
        sendJson(response, 201, { session })
        return
      }

      const sessionDetailMatch = pathname.match(SESSION_DETAIL_PATTERN)
      if (sessionDetailMatch) {
        const sessionId = sessionDetailMatch[1]

        if (method === 'GET') {
          try {
            const detail = await sessionManager.getSessionResponse(sessionId)
            sendJson(response, 200, detail)
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            sendError(response, message.includes('不存在') ? 404 : 500, message)
          }
          return
        }

        if (method === 'DELETE') {
          try {
            await sessionManager.deleteSession(sessionId)
            sendJson(response, 200, { deleted: true, sessionId })
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            const statusCode = message.includes('不存在')
              ? 404
              : message.includes('正在回复')
                ? 409
                : 500
            sendError(response, statusCode, message)
          }
          return
        }
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
          await sessionManager.acceptPrompt(sessionId, body.message)
          sendJson(response, 202, { accepted: true })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          sendError(response, mapSessionCommandError(message), message)
        }
        return
      }

      const abortMatch = pathname.match(SESSION_ABORT_PATTERN)
      if (method === 'POST' && abortMatch) {
        const sessionId = abortMatch[1]
        try {
          await sessionManager.abortSession(sessionId)
          sendJson(response, 200, { aborted: true })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          sendError(response, mapSessionCommandError(message), message)
        }
        return
      }

      const steerMatch = pathname.match(SESSION_STEER_PATTERN)
      if (method === 'POST' && steerMatch) {
        const sessionId = steerMatch[1]
        const body = await readJsonBody<SessionSteerRequest>(request)
        if (!body.message?.trim()) {
          sendError(response, 400, 'message 不能为空')
          return
        }

        try {
          await sessionManager.steerSession(sessionId, body.message)
          sendJson(response, 202, { accepted: true })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          sendError(response, mapSessionCommandError(message), message)
        }
        return
      }

      const followUpMatch = pathname.match(SESSION_FOLLOW_UP_PATTERN)
      if (method === 'POST' && followUpMatch) {
        const sessionId = followUpMatch[1]
        const body = await readJsonBody<SessionFollowUpRequest>(request)
        if (!body.message?.trim()) {
          sendError(response, 400, 'message 不能为空')
          return
        }

        try {
          await sessionManager.followUpSession(sessionId, body.message)
          sendJson(response, 202, { accepted: true })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          sendError(response, mapSessionCommandError(message), message)
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
