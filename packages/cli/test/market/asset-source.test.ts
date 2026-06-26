import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { BUILTIN_PERSONA_GENERAL } from '@museai/shared'
import { enrichPersonaWithSource } from '@/market/asset-source.js'
import { getMusePaths } from '@/paths.js'

describe('enrichPersonaWithSource', () => {
  afterEach(() => {
    delete process.env.MUSE_HOME
  })

  it('无 .muse-origin.json 时应为 local', async () => {
    const tempHome = await mkdtemp(join(tmpdir(), 'muse-asset-source-'))
    process.env.MUSE_HOME = tempHome
    const paths = getMusePaths()
    const persona = { id: BUILTIN_PERSONA_GENERAL, name: '通用' }
    const enriched = await enrichPersonaWithSource(paths, persona)
    expect(enriched.source).toBe('local')
  })

  it('有 .muse-origin.json 时应为 market', async () => {
    const tempHome = await mkdtemp(join(tmpdir(), 'muse-asset-source-'))
    process.env.MUSE_HOME = tempHome
    const paths = getMusePaths()
    const personaDir = join(paths.personas, 'museai/basic-kit/general')
    await mkdir(personaDir, { recursive: true })
    await writeFile(
      join(personaDir, '.muse-origin.json'),
      `${JSON.stringify({ packageId: 'museai/basic-kit', packageVersion: '1.0.0', installedAt: '2026-01-01T00:00:00.000Z' })}\n`,
    )
    const persona = { id: BUILTIN_PERSONA_GENERAL, name: '通用' }
    const enriched = await enrichPersonaWithSource(paths, persona)
    expect(enriched.source).toBe('market')
  })

  it('local/ 前缀应始终为 local', async () => {
    const tempHome = await mkdtemp(join(tmpdir(), 'muse-asset-source-'))
    process.env.MUSE_HOME = tempHome
    const paths = getMusePaths()
    const personaDir = join(paths.personas, 'local/demo')
    await mkdir(personaDir, { recursive: true })
    await writeFile(join(personaDir, '.muse-origin.json'), '{}\n')
    const persona = { id: 'local/demo', name: '本地' }
    const enriched = await enrichPersonaWithSource(paths, persona)
    expect(enriched.source).toBe('local')
  })
})
