import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { BUILTIN_CODING_AGENT_ID, BUILTIN_GENERAL_AGENT_ID } from '@muse-ai/shared'
import { createAgentCommandDeps, runAgentCommand } from '@/commands/agent.js'
import { ensureMuseDir } from '@/paths.js'
import { getBundledAssetsRoot } from '@/assets-path.js'

async function createTestDeps() {
  const tempHome = await mkdtemp(join(tmpdir(), 'muse-agent-cmd-'))
  process.env.MUSE_HOME = tempHome
  const musePaths = {
    home: tempHome,
    config: join(tempHome, 'config.json'),
    sessions: join(tempHome, 'sessions'),
    agents: join(tempHome, 'agents'),
    personas: join(tempHome, 'personas'),
    skills: join(tempHome, 'skills'),
    mcps: join(tempHome, 'mcps'),
  }
  await ensureMuseDir(musePaths)
  const deps = createAgentCommandDeps(musePaths)
  return { deps, tempHome }
}

describe('runAgentCommand', () => {
  afterEach(() => {
    delete process.env.MUSE_HOME
  })

  it('list 应列出内置 Agent', async () => {
    const { deps } = await createTestDeps()
    expect(getBundledAssetsRoot()).toContain('assets')

    const code = await runAgentCommand(['list'], deps)
    expect(code).toBe(0)

    const agents = await deps.registry.listAgents()
    expect(agents.some(a => a.id === BUILTIN_GENERAL_AGENT_ID)).toBe(true)
    expect(agents.some(a => a.id === BUILTIN_CODING_AGENT_ID)).toBe(true)
  })

  it('use 应写入 activeAgentId', async () => {
    const { deps } = await createTestDeps()
    const code = await runAgentCommand(['use', BUILTIN_CODING_AGENT_ID], deps)
    expect(code).toBe(0)

    const config = await deps.loadConfig()
    expect(config.activeAgentId).toBe(BUILTIN_CODING_AGENT_ID)
  })

  it('create 应写入用户 Agent 目录', async () => {
    const { deps } = await createTestDeps()
    const code = await runAgentCommand(['create', '--name', '我的助手', '--persona', 'coding', '--skills', 'git'], deps)
    expect(code).toBe(0)

    const agents = await deps.registry.listAgents()
    const created = agents.find(a => a.name === '我的助手')
    expect(created?.personaId).toBe('coding')
    expect(created?.skillIds).toEqual(['git'])
  })
})
