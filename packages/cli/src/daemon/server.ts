import { createServer, type Server } from 'node:http'
import type { DaemonState } from '@muse-ai/shared'
import { DEFAULT_DAEMON_HOST } from '@muse-ai/shared'
import { attachWebSocketServer } from './ws-handler'
import { createHttpHandler } from './http-handler'

export interface DaemonServer {
  server: Server
  state: DaemonState
}

export function startDaemonServer(state: DaemonState): Promise<DaemonServer> {
  const handler = createHttpHandler(state)
  const server = createServer((request, response) => {
    void handler(request, response)
  })

  attachWebSocketServer(server)

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(state.port, DEFAULT_DAEMON_HOST, () => {
      resolve({ server, state })
    })
  })
}

export function stopDaemonServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
}
