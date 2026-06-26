import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_AGENT_ID } from '@museai/shared'
import { basicKitAgentId } from '@/market/resolve-agent-id.js'
import { ensureMuseDir, getMusePaths } from '@/paths.js'
import { installMusepackAssets } from '@/market/install-musepack-assets.js'

describe('installMusepackAssets', () => {
  it('应将简路径 musepack 落盘为 scoped ~/.muse 布局', async () => {
    const extractDir = await mkdtemp(join(tmpdir(), 'muse-extract-'))
    const tempHome = await mkdtemp(join(tmpdir(), 'muse-home-'))
    process.env.MUSE_HOME = tempHome

    try {
      await writeFile(
        join(extractDir, 'manifest.json'),
        `${JSON.stringify({
          id: 'museai/basic-kit',
          version: '1.0.0',
          kind: 'kit',
          name: '测试套件',
          author: 'museai',
        })}\n`,
      )
      await mkdir(join(extractDir, 'personas/general'), { recursive: true })
      await mkdir(join(extractDir, 'skills/git'), { recursive: true })
      await mkdir(join(extractDir, 'agents/general'), { recursive: true })
      await writeFile(join(extractDir, 'personas/general/persona.json'), `${JSON.stringify({ name: '通用', systemPromptPath: 'system.md' })}\n`)
      await writeFile(join(extractDir, 'personas/general/system.md'), '# general\n')
      await writeFile(join(extractDir, 'skills/git/SKILL.md'), '---\nname: git\ndescription: git\n---\n')
      await writeFile(
        join(extractDir, 'agents/general/agent.json'),
        `${JSON.stringify({
          name: '通用助手',
          skillIds: [],
          activeToolNames: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        })}\n`,
      )

      const paths = getMusePaths()
      await ensureMuseDir(paths)
      const assets = await installMusepackAssets(paths, JSON.parse(await readFile(join(extractDir, 'manifest.json'), 'utf8')), extractDir)

      const persona = JSON.parse(await readFile(join(paths.personas, 'museai/basic-kit/general/persona.json'), 'utf8')) as { id: string }
      expect(persona.id).toBe('museai/basic-kit/general')

      const agent = JSON.parse(await readFile(join(paths.agents, DEFAULT_AGENT_ID, 'agent.json'), 'utf8')) as {
        personaId: string
      }
      expect(agent.personaId).toBe('museai/basic-kit/general')

      expect(assets).toEqual(
        expect.arrayContaining([
          { type: 'persona', id: 'museai/basic-kit/general' },
          { type: 'skill', id: 'museai/basic-kit/git' },
          { type: 'agent', id: DEFAULT_AGENT_ID },
        ]),
      )
      expect(assets.find(a => a.id === basicKitAgentId('coding'))).toBeUndefined()
    } finally {
      delete process.env.MUSE_HOME
      await rm(extractDir, { recursive: true, force: true })
      await rm(tempHome, { recursive: true, force: true })
    }
  })
})
