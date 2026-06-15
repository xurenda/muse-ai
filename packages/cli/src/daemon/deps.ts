import { join } from 'node:path'
import { MuseSessionStore } from '@muse-ai/core'
import { getMusePaths } from '../paths.js'
import { ChatService } from './chat-service.js'
import { SessionEventHub } from './event-hub.js'

export interface CliDaemonDeps {
  sessionStore: MuseSessionStore
  eventHub: SessionEventHub
  chatService: ChatService
}

export function createCliDaemonDeps(options?: { musePaths?: ReturnType<typeof getMusePaths>; cwd?: string }): CliDaemonDeps {
  const musePaths = options?.musePaths ?? getMusePaths()
  const cwd = options?.cwd ?? process.cwd()

  const sessionStore = new MuseSessionStore({
    sessionsRoot: musePaths.sessions,
    registryPath: join(musePaths.sessions, 'registry.json'),
    cwd,
  })

  const eventHub = new SessionEventHub()
  const chatService = new ChatService(sessionStore, eventHub)

  return { sessionStore, eventHub, chatService }
}
