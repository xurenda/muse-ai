import { MuseAgentRegistry } from '@museai/core'
import { createAssetRoots } from '../assets-path.js'
import { getMusePaths, loadMuseConfig, saveMuseConfig, type MusePaths } from '../paths.js'

export interface AgentCommandDeps {
  musePaths: MusePaths
  registry: MuseAgentRegistry
  loadConfig: () => Promise<{ activeAgentId?: string }>
  saveActiveAgentId: (agentId: string) => Promise<void>
}

export function createAgentCommandDeps(musePaths: MusePaths = getMusePaths(), cwd: string = process.cwd()): AgentCommandDeps {
  const registry = new MuseAgentRegistry({
    roots: createAssetRoots(musePaths),
    cwd,
  })

  return {
    musePaths,
    registry,
    loadConfig: () => loadMuseConfig(musePaths),
    saveActiveAgentId: async (agentId: string) => {
      await saveMuseConfig({ activeAgentId: agentId }, musePaths)
    },
  }
}

function readFlag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  if (index === -1 || index + 1 >= args.length) return undefined
  return args[index + 1]
}

function parseSkillIds(raw: string | undefined): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

export async function runAgentCommand(argv: string[], deps: AgentCommandDeps = createAgentCommandDeps()): Promise<number> {
  const subcommand = argv[0]

  switch (subcommand) {
    case 'list': {
      const agents = await deps.registry.listAgents()
      const config = await deps.loadConfig()
      for (const agent of agents) {
        const active = config.activeAgentId === agent.id ? ' *' : ''
        const skills = agent.skillIds.length > 0 ? agent.skillIds.join(',') : '-'
        console.log(`${agent.id}${active}\t${agent.name}\tpersona=${agent.personaId}\tskills=${skills}`)
      }
      return 0
    }
    case 'create': {
      const name = readFlag(argv, '--name')
      const personaId = readFlag(argv, '--persona')
      const skillIds = parseSkillIds(readFlag(argv, '--skills'))
      const description = readFlag(argv, '--description')

      if (!name || !personaId) {
        console.error('用法: muse agent create --name <名称> --persona <personaId> [--skills id1,id2] [--description 说明]')
        return 1
      }

      const agent = await deps.registry.createAgent({ name, personaId, skillIds, description })
      console.log(agent.id)
      return 0
    }
    case 'use': {
      const agentId = argv[1]
      if (!agentId) {
        console.error('用法: muse agent use <agentId>')
        return 1
      }

      const agent = await deps.registry.getAgent(agentId)
      if (!agent) {
        console.error(`Agent 不存在: ${agentId}`)
        return 1
      }

      await deps.saveActiveAgentId(agentId)
      console.log(`已切换默认 Agent: ${agent.name} (${agentId})`)
      return 0
    }
    default:
      console.error('用法: muse agent list | create | use')
      return 1
  }
}
