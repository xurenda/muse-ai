import { join } from 'node:path'
import { MuseAgentRegistry, MuseSessionStore } from '@muse-ai/core'
import { createAssetRoots } from '../assets-path.js'
import { getMusePaths, loadMuseConfig } from '../paths.js'
import { ChatService } from './chat-service.js'
import { SessionSettingsService } from './session-settings-service.js'
import { SessionTitleService } from './session-title-service.js'
import { resolveCliAuthState, type CliAuthState } from './auth-middleware.js'
import { resolveBackendUrl } from '../backend/llm-auth.js'
import { SessionEventHub } from './event-hub.js'

export interface CliDaemonDeps {
  sessionStore: MuseSessionStore
  eventHub: SessionEventHub
  chatService: ChatService
  sessionSettingsService: SessionSettingsService
  agentRegistry: MuseAgentRegistry
  resolveDefaultAgentId: () => Promise<string>
  authState: CliAuthState
}

export async function createCliDaemonDeps(options?: {
  musePaths?: ReturnType<typeof getMusePaths>
  cwd?: string
  bundledAssetsRoot?: string
}): Promise<CliDaemonDeps> {
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

  const resolveBackendAuth = async () => {
    try {
      const museConfig = await loadMuseConfig(musePaths)
      if (!museConfig.deviceToken) return undefined
      return {
        backendUrl: resolveBackendUrl(museConfig.backendUrl),
        deviceToken: museConfig.deviceToken,
      }
    } catch {
      return undefined
    }
  }

  const sessionSettingsService = new SessionSettingsService(sessionStore, agentRegistry, cwd)
  const sessionTitleService = new SessionTitleService(sessionStore, sessionSettingsService, eventHub, resolveBackendAuth)
  const chatService = new ChatService(sessionStore, eventHub, sessionTitleService, agentRegistry, cwd, resolveBackendAuth)

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

  let authState: CliAuthState = {}
  try {
    const museConfig = await loadMuseConfig(musePaths)
    authState = resolveCliAuthState(museConfig)
  } catch {
    authState = {}
  }

  return { sessionStore, eventHub, chatService, sessionSettingsService, agentRegistry, resolveDefaultAgentId, authState }
}
