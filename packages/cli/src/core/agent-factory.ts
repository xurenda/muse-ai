import { readFile } from 'node:fs/promises'
import { Agent } from '@earendil-works/pi-agent-core'
import type { AgentInstanceConfig } from '@muse-ai/shared'
import { getAgentConfigPath, getAgentSystemPath } from '../data/paths'
import { readJsonFile } from './read-json-file'
import { createMuseExtensionHost, type MuseExtensionHost } from './extension-host'
import { museModelService } from './model-service'

function buildSystemPrompt(systemMd: string, cwd?: string): string {
  const trimmed = systemMd.trim()
  if (!cwd) {
    return trimmed
  }
  return `${trimmed}\n\n当前工作目录: ${cwd.replace(/\\/g, '/')}`
}

export async function loadAgentInstanceConfig(agentId: string): Promise<AgentInstanceConfig> {
  return readJsonFile<AgentInstanceConfig>(getAgentConfigPath(agentId))
}

export interface SessionAgentBundle {
  agent: Agent
  extensionHost: MuseExtensionHost
}

export async function createSessionAgent(options: {
  agentId: string
  sessionId: string
  cwd?: string
}): Promise<SessionAgentBundle> {
  await museModelService.reload()

  const cwd = options.cwd ?? process.cwd()
  const config = await loadAgentInstanceConfig(options.agentId)
  const systemMd = await readFile(getAgentSystemPath(options.agentId), 'utf8')
  const model = museModelService.resolveModel(config)

  const extensionHost = await createMuseExtensionHost({
    agentId: options.agentId,
    sessionId: options.sessionId,
    cwd,
  })

  const agent = new Agent({
    initialState: {
      model,
      systemPrompt: buildSystemPrompt(systemMd, options.cwd),
      tools: extensionHost.getTools(),
    },
    getApiKey: (provider) => museModelService.getApiKey(provider),
  })

  extensionHost.wireAgent(agent)

  return { agent, extensionHost }
}
