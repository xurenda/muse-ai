import type { IncomingMessage } from 'node:http'
import type { Server } from 'node:http'
import type { Duplex } from 'node:stream'
import { WebSocketServer } from 'ws'
import { sessionManager } from '../core/session-manager'

const SESSION_EVENTS_PATTERN = /^\/sessions\/([^/]+)\/events$/

export function attachWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
    const match = pathname.match(SESSION_EVENTS_PATTERN)
    if (!match) {
      socket.destroy()
      return
    }

    const sessionId = match[1]
    wss.handleUpgrade(request, socket, head, (ws) => {
      void sessionManager
        .attachClient(sessionId, ws)
        .catch(() => {
          ws.close(4404, 'session not found')
        })
    })
  })

  return wss
}
