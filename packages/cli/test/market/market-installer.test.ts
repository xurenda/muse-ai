import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_AGENT_ID, basicKitAssetId, BASIC_KIT_PACKAGE_ID } from '@museai/shared'
import { MuseAgentRegistry } from '@museai/core'
import { syncBasicKit } from '@/market/market-installer.js'
import { readInstalledPackages } from '@/market/installed-store.js'
import { ensureMuseDir, getMusePaths } from '@/paths.js'

async function createTempMusePaths() {
  const tempHome = await mkdtemp(join(tmpdir(), 'muse-market-'))
  process.env.MUSE_HOME = tempHome
  const paths = getMusePaths()
  await ensureMuseDir(paths)
  return paths
}

describe('syncBasicKit', () => {
  afterEach(() => {
    delete process.env.MUSE_HOME
  })

  it('首装应落盘 basic-kit 并写入 installed.json 与 .muse-origin.json', async () => {
    const paths = await createTempMusePaths()
    const result = await syncBasicKit(paths)

    expect(result.action).toBe('installed')
    expect(result.packageId).toBe(BASIC_KIT_PACKAGE_ID)
    expect(result.version).toBe('1.0.0')

    const installed = await readInstalledPackages(paths)
    expect(installed.packages[BASIC_KIT_PACKAGE_ID]?.version).toBe('1.0.0')
    expect(installed.packages[BASIC_KIT_PACKAGE_ID]?.assets).toHaveLength(6)

    const origin = JSON.parse(await readFile(join(paths.personas, 'museai/basic-kit/general/.muse-origin.json'), 'utf8')) as {
      packageId: string
      packageVersion: string
    }
    expect(origin.packageId).toBe(BASIC_KIT_PACKAGE_ID)
    expect(origin.packageVersion).toBe('1.0.0')

    const registry = new MuseAgentRegistry({
      cwd: paths.home,
      roots: { agents: paths.agents, personas: paths.personas, skills: paths.skills },
    })
    const agents = await registry.listAgents()
    expect(agents.some(agent => agent.id === DEFAULT_AGENT_ID)).toBe(true)
    expect((await registry.listPersonas()).some(persona => persona.id === basicKitAssetId('general'))).toBe(true)
    expect((await registry.listSkills()).some(skill => skill.id === basicKitAssetId('git'))).toBe(true)
  })

  it('版本已是最新时应跳过同步', async () => {
    const paths = await createTempMusePaths()
    const first = await syncBasicKit(paths)
    expect(first.action).toBe('installed')

    const second = await syncBasicKit(paths)
    expect(second.action).toBe('skipped')
    expect(second.version).toBe('1.0.0')
  })
})
