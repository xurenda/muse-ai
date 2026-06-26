import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BUILTIN_PERSONA_CODING, BUILTIN_PERSONA_GENERAL, BUILTIN_SKILL_GIT, BUILTIN_SKILL_REVIEW } from '@museai/shared'
import { MuseAgentRegistry, composeSystemPrompt } from '../src/agent-registry.js'

const fixturesRoot = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures')

function createRegistry(): MuseAgentRegistry {
  return new MuseAgentRegistry({
    cwd: fixturesRoot,
    roots: {
      agents: join(fixturesRoot, 'agents'),
      personas: join(fixturesRoot, 'personas'),
      skills: join(fixturesRoot, 'skills'),
    },
  })
}

describe('composeSystemPrompt', () => {
  it('无 skills 时应只返回 persona 正文', () => {
    expect(composeSystemPrompt('你是助手。', [])).toBe('你是助手。')
  })
})

describe('MuseAgentRegistry', () => {
  it('应加载内置 Agent 列表', async () => {
    const registry = createRegistry()
    const agents = await registry.listAgents()
    expect(agents.length).toBeGreaterThanOrEqual(2)
    expect(agents.some(a => a.name === '通用助手')).toBe(true)
    expect(agents.some(a => a.name === '编程助手')).toBe(true)
  })

  it('应递归列举 scoped Persona 与 Skill', async () => {
    const registry = createRegistry()
    const personas = await registry.listPersonas()
    const skills = await registry.listSkills()

    expect(personas.some(p => p.id === BUILTIN_PERSONA_GENERAL)).toBe(true)
    expect(personas.some(p => p.id === BUILTIN_PERSONA_CODING)).toBe(true)
    expect(skills.some(s => s.id === BUILTIN_SKILL_GIT)).toBe(true)
    expect(skills.some(s => s.id === BUILTIN_SKILL_REVIEW)).toBe(true)
  })

  it('编程助手 system prompt 应包含 skills 索引', async () => {
    const registry = createRegistry()
    const coding = (await registry.listAgents()).find(a => a.name === '编程助手')
    expect(coding).toBeDefined()

    const context = await registry.resolveRuntimeContext(coding!.id)
    expect(context.systemPrompt).toContain('你是测试编程助手')
    expect(context.systemPrompt).toContain('<available_skills>')
    expect(context.systemPrompt).toContain('<name>git</name>')
    expect(context.systemPrompt).toContain('<name>review</name>')
  })

  it('通用助手不应注入 skills 块', async () => {
    const registry = createRegistry()
    const general = (await registry.listAgents()).find(a => a.name === '通用助手')
    const context = await registry.resolveRuntimeContext(general!.id)
    expect(context.systemPrompt).not.toContain('<available_skills>')
  })

  it('resolveDefaultAgentId 应回退内置通用助手', () => {
    const registry = createRegistry()
    expect(registry.resolveDefaultAgentId()).toBe('00000000-0000-4000-8000-000000000001')
    expect(registry.resolveDefaultAgentId('custom-id')).toBe('custom-id')
  })

  it('非法资产 id 应拒绝路径穿越', async () => {
    const registry = createRegistry()
    await expect(registry.loadPersona('../etc/passwd')).rejects.toThrow(/非法资产 id/)
  })
})
