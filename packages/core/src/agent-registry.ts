import { access, readFile, readdir, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { formatSkillsForSystemPrompt, loadSkills, NodeExecutionEnv, type Skill, type ThinkingLevel } from '@earendil-works/pi-agent-core/node'
import {
  agentDefinitionSchema,
  BUILTIN_GENERAL_AGENT_ID,
  personaSchema,
  skillMetaSchema,
  type AgentDefinition,
  type Persona,
  type SkillMeta,
} from '@museai/shared'
import { DEFAULT_MODEL_REF, parseModelRef } from './model-ref.js'
import type { MuseHarnessOptions } from './types.js'

/** `~/.muse/` 下 agents / personas / skills 根目录 */
export interface MuseAssetRoots {
  agents: string
  personas: string
  skills: string
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
  activeToolNames?: string[]
  description?: string
}

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

function assertSafeAssetId(id: string): void {
  const segments = id.split('/')
  if (segments.length === 0 || segments.some(segment => segment === '' || segment === '.' || segment === '..')) {
    throw new Error(`非法资产 id: ${id}`)
  }
}

function joinAssetId(root: string, id: string): string {
  assertSafeAssetId(id)
  return join(root, ...id.split('/'))
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

/** 加载、列出、实例化 Agent；资产目录只读自 roots（通常为 ~/.muse/） */
export class MuseAgentRegistry {
  private readonly env: NodeExecutionEnv
  private readonly roots: MuseAssetRoots

  constructor(options: { roots: MuseAssetRoots; cwd: string }) {
    this.roots = options.roots
    this.env = new NodeExecutionEnv({ cwd: options.cwd })
  }

  /** 将 scoped id 解析为磁盘目录（id 中 `/` 对应嵌套子目录） */
  private async resolveAssetDir(kind: 'agents' | 'personas' | 'skills', id: string): Promise<string | undefined> {
    const dir = joinAssetId(this.roots[kind], id)
    if (await pathAccessible(dir)) return dir
    return undefined
  }

  private async collectPersonaDirs(root: string, relativeDir = ''): Promise<Array<{ dir: string; persona: Persona }>> {
    const absDir = relativeDir ? join(root, relativeDir) : root
    if (!(await pathAccessible(absDir))) return []

    const personaFile = join(absDir, PERSONA_FILE)
    if (await pathAccessible(personaFile)) {
      const persona = personaSchema.parse(await readJsonFile(personaFile))
      return [{ dir: absDir, persona }]
    }

    const found: Array<{ dir: string; persona: Persona }> = []
    for (const name of await listSubdirs(absDir)) {
      const childRelative = relativeDir ? `${relativeDir}/${name}` : name
      found.push(...(await this.collectPersonaDirs(root, childRelative)))
    }
    return found
  }

  private async collectSkillDirs(root: string, relativeDir = ''): Promise<Array<{ id: string; dir: string }>> {
    const absDir = relativeDir ? join(root, relativeDir) : root
    if (!(await pathAccessible(absDir))) return []

    const skillFile = join(absDir, 'SKILL.md')
    if (await pathAccessible(skillFile)) {
      const id = relativeDir.replaceAll('\\', '/')
      if (!id) return []
      return [{ id, dir: absDir }]
    }

    const found: Array<{ id: string; dir: string }> = []
    for (const name of await listSubdirs(absDir)) {
      const childRelative = relativeDir ? `${relativeDir}/${name}` : name
      found.push(...(await this.collectSkillDirs(root, childRelative)))
    }
    return found
  }

  async listAgents(): Promise<AgentDefinition[]> {
    const byId = new Map<string, AgentDefinition>()

    for (const dirName of await listSubdirs(this.roots.agents)) {
      const agent = await this.loadAgentFromDir(join(this.roots.agents, dirName))
      if (agent) {
        byId.set(agent.id, agent)
      }
    }

    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  }

  async getAgent(id: string): Promise<AgentDefinition | undefined> {
    const agents = await this.listAgents()
    return agents.find(agent => agent.id === id)
  }

  async listPersonas(): Promise<Persona[]> {
    const byId = new Map<string, Persona>()
    for (const { persona } of await this.collectPersonaDirs(this.roots.personas)) {
      byId.set(persona.id, persona)
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  }

  async listSkills(): Promise<SkillMeta[]> {
    const byId = new Map<string, SkillMeta>()
    for (const { id, dir } of await this.collectSkillDirs(this.roots.skills)) {
      const { skills: loaded } = await loadSkills(this.env, dir)
      for (const skill of loaded) {
        byId.set(
          id,
          skillMetaSchema.parse({
            id,
            name: skill.name,
            description: skill.description,
          }),
        )
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
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
      activeToolNames: input.activeToolNames ?? [],
      createdAt: now,
      updatedAt: now,
    })

    const agentDir = join(this.roots.agents, agent.id)
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
