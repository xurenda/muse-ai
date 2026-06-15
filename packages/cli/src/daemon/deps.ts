import { join } from 'node:path'
import { MuseAgentRegistry, MuseSessionStore } from '@muse-ai/core'
import { createAssetRoots } from '../assets-path.js'
import { getMusePaths, loadMuseConfig } from '../paths.js'
import { ChatService } from './chat-service.js'
import { SessionEventHub } from './event-hub.js'

export interface CliDaemonDeps {
  sessionStore: MuseSessionStore
  eventHub: SessionEventHub
  chatService: ChatService
  agentRegistry: MuseAgentRegistry
  resolveDefaultAgentId: () => Promise<string>
}

export function createCliDaemonDeps(options?: { musePaths?: ReturnType<typeof getMusePaths>; cwd?: string; bundledAssetsRoot?: string }): CliDaemonDeps {
  const musePaths = options?.musePaths ?? getMusePaths()
  const cwd = options?.cwd ?? process.cwd()
  const assetRoots =
    options?.bundledAssetsRoot !== undefined
      ? {
          user: {
            agents: musePaths.agents,
            personas: musePaths.personas,
            skills: musePaths.skills,
          },
          bundled: {
            agents: join(options.bundledAssetsRoot, 'agents'),
            personas: join(options.bundledAssetsRoot, 'personas'),
            skills: join(options.bundledAssetsRoot, 'skills'),
          },
        }
      : createAssetRoots(musePaths)

  const sessionStore = new MuseSessionStore({
    sessionsRoot: musePaths.sessions,
    registryPath: join(musePaths.sessions, 'registry.json'),
    cwd,
  })

  const agentRegistry = new MuseAgentRegistry({ roots: assetRoots, cwd })
  const eventHub = new SessionEventHub()
  const chatService = new ChatService(sessionStore, eventHub, agentRegistry)

  const resolveDefaultAgentId = async (): Promise<string> => {
    let activeAgentId: string | undefined
    try {
      const config = await loadMuseConfig(musePaths)
      activeAgentId = config.activeAgentId
    } catch {
      activeAgentId = undefined
    }
    return agentRegistry.resolveDefaultAgentId(activeAgentId)
  }

  return { sessionStore, eventHub, chatService, agentRegistry, resolveDefaultAgentId }
}
