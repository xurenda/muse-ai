import { access, readFile, readdir, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { formatSkillsForSystemPrompt, loadSkills, NodeExecutionEnv, type Skill, type ThinkingLevel } from '@earendil-works/pi-agent-core/node'
import { getModel } from '@earendil-works/pi-ai'
import type { Model } from '@earendil-works/pi-ai'
import { agentDefinitionSchema, BUILTIN_GENERAL_AGENT_ID, personaSchema, type AgentDefinition, type Persona } from '@muse-ai/shared'
import type { MuseHarnessOptions } from './types.js'

/** 用户目录与内置只读资产目录 */
export interface MuseAssetRoots {
  user: { agents: string; personas: string; skills: string }
  bundled: { agents: string; personas: string; skills: string }
}

export interface LoadedPersona {
  definition: Persona
  /** persona.json 所在目录 */
  dir: string
  systemPrompt: string
}

export interface AgentRuntimeContext {
  agent: AgentDefinition
  persona: LoadedPersona
  skills: Skill[]
  systemPrompt: string
}

export interface CreateAgentInput {
  name: string
  personaId: string
  skillIds: string[]
  description?: string
}

const DEFAULT_MODEL_REF = 'anthropic/claude-sonnet-4-20250514'
const AGENT_FILE = 'agent.json'
const PERSONA_FILE = 'persona.json'

async function pathAccessible(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function readJsonFile(path: string): Promise<unknown> {
  const raw = await readFile(path, 'utf8')
  return JSON.parse(raw) as unknown
}

async function listSubdirs(root: string): Promise<string[]> {
  if (!(await pathAccessible(root))) return []
  const entries = await readdir(root, { withFileTypes: true })
  return entries.filter(entry => entry.isDirectory()).map(entry => entry.name)
}

function parseModelRef(ref: string): Model<string> {
  const slash = ref.indexOf('/')
  if (slash <= 0) {
    throw new Error(`无效的 model 引用: ${ref}`)
  }
  const provider = ref.slice(0, slash)
  const modelId = ref.slice(slash + 1)
  return (getModel as (provider: string, modelId: string) => Model<string>)(provider, modelId)
}

/** 组装 Persona system.md 与 Skills 索引块 */
export function composeSystemPrompt(personaPrompt: string, skills: Skill[]): string {
  const skillsBlock = formatSkillsForSystemPrompt(skills)
  const parts = [personaPrompt.trim()]
  if (skillsBlock.trim()) {
    parts.push(skillsBlock.trim())
  }
  return parts.join('\n\n')
}

/** 加载、列出、实例化 Agent；内置资产只读，用户 Agent 写入 user.agents */
export class MuseAgentRegistry {
  private readonly env: NodeExecutionEnv
  private readonly roots: MuseAssetRoots

  constructor(options: { roots: MuseAssetRoots; cwd: string }) {
    this.roots = options.roots
    this.env = new NodeExecutionEnv({ cwd: options.cwd })
  }

  /** 解析资产目录：用户优先，其次内置 */
  private async resolveAssetDir(kind: 'agents' | 'personas' | 'skills', id: string): Promise<string | undefined> {
    const userDir = join(this.roots.user[kind], id)
    if (await pathAccessible(userDir)) return userDir

    const bundledDir = join(this.roots.bundled[kind], id)
    if (await pathAccessible(bundledDir)) return bundledDir

    return undefined
  }

  async listAgents(): Promise<AgentDefinition[]> {
    const byId = new Map<string, AgentDefinition>()

    for (const source of [this.roots.bundled.agents, this.roots.user.agents]) {
      for (const dirName of await listSubdirs(source)) {
        const agent = await this.loadAgentFromDir(join(source, dirName))
        if (agent) {
          byId.set(agent.id, agent)
        }
      }
    }

    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  }

  async getAgent(id: string): Promise<AgentDefinition | undefined> {
    const agents = await this.listAgents()
    return agents.find(agent => agent.id === id)
  }

  async loadPersona(personaId: string): Promise<LoadedPersona | undefined> {
    const dir = await this.resolveAssetDir('personas', personaId)
    if (!dir) return undefined

    const parsed = personaSchema.parse(await readJsonFile(join(dir, PERSONA_FILE)))
    if (parsed.id !== personaId) {
      throw new Error(`Persona id 不匹配: 目录 ${personaId}，文件声明 ${parsed.id}`)
    }

    const systemPrompt = await readFile(join(dir, parsed.systemPromptPath), 'utf8')
    return { definition: parsed, dir, systemPrompt }
  }

  async loadSkillsForAgent(skillIds: string[]): Promise<Skill[]> {
    const skills: Skill[] = []

    for (const skillId of skillIds) {
      const dir = await this.resolveAssetDir('skills', skillId)
      if (!dir) {
        throw new Error(`Skill 不存在: ${skillId}`)
      }

      const { skills: loaded } = await loadSkills(this.env, dir)
      if (loaded.length === 0) {
        throw new Error(`Skill 目录无有效 SKILL.md: ${skillId}`)
      }
      skills.push(...loaded)
    }

    return skills
  }

  async resolveRuntimeContext(agentId: string): Promise<AgentRuntimeContext> {
    const agent = await this.getAgent(agentId)
    if (!agent) {
      throw new Error(`Agent 不存在: ${agentId}`)
    }

    const persona = await this.loadPersona(agent.personaId)
    if (!persona) {
      throw new Error(`Persona 不存在: ${agent.personaId}`)
    }

    const skills = await this.loadSkillsForAgent(agent.skillIds)
    const systemPrompt = composeSystemPrompt(persona.systemPrompt, skills)

    return { agent, persona, skills, systemPrompt }
  }

  buildHarnessOptions(context: AgentRuntimeContext, session: MuseHarnessOptions['session'], cwd: string): MuseHarnessOptions {
    const modelRef = context.persona.definition.defaultModel ?? DEFAULT_MODEL_REF
    const thinkingLevel = (context.persona.definition.thinkingLevel ?? 'off') as ThinkingLevel

    return {
      cwd,
      session,
      model: parseModelRef(modelRef),
      systemPrompt: context.systemPrompt,
      tools: [],
      activeToolNames: context.agent.activeToolNames,
      thinkingLevel,
    }
  }

  async createAgent(input: CreateAgentInput): Promise<AgentDefinition> {
    const persona = await this.loadPersona(input.personaId)
    if (!persona) {
      throw new Error(`Persona 不存在: ${input.personaId}`)
    }

    for (const skillId of input.skillIds) {
      const dir = await this.resolveAssetDir('skills', skillId)
      if (!dir) {
        throw new Error(`Skill 不存在: ${skillId}`)
      }
    }

    const now = new Date().toISOString()
    const agent: AgentDefinition = agentDefinitionSchema.parse({
      id: randomUUID(),
      name: input.name,
      personaId: input.personaId,
      skillIds: input.skillIds,
      description: input.description,
      activeToolNames: [],
      createdAt: now,
      updatedAt: now,
    })

    const agentDir = join(this.roots.user.agents, agent.id)
    await mkdir(agentDir, { recursive: true })
    await writeFile(join(agentDir, AGENT_FILE), `${JSON.stringify(agent, null, 2)}\n`, 'utf8')
    return agent
  }

  /** 默认 Agent：config.activeAgentId → 内置通用助手 */
  resolveDefaultAgentId(activeAgentId?: string): string {
    return activeAgentId ?? BUILTIN_GENERAL_AGENT_ID
  }

  private async loadAgentFromDir(dir: string): Promise<AgentDefinition | undefined> {
    const filePath = join(dir, AGENT_FILE)
    if (!(await pathAccessible(filePath))) return undefined
    return agentDefinitionSchema.parse(await readJsonFile(filePath))
  }
}
