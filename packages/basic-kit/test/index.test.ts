import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BASIC_KIT_PACKAGE_ID, getBasicKitAssetsRoot, getBasicKitVersion } from '../src/index.js'

describe('@museai/basic-kit', () => {
  it('导出包 id 与版本，且与 manifest 一致', () => {
    const assetsRoot = getBasicKitAssetsRoot()
    const manifest = JSON.parse(readFileSync(join(assetsRoot, '..', 'manifest.json'), 'utf8')) as {
      id: string
      version: string
    }

    expect(BASIC_KIT_PACKAGE_ID).toBe('museai/basic-kit')
    expect(getBasicKitVersion()).toBe('1.0.0')
    expect(manifest.id).toBe(BASIC_KIT_PACKAGE_ID)
    expect(manifest.version).toBe(getBasicKitVersion())
  })

  it('资产目录包含 scoped id 的 persona 与 agent', () => {
    const root = getBasicKitAssetsRoot()

    const generalPersona = JSON.parse(readFileSync(join(root, 'personas/museai/basic-kit/general/persona.json'), 'utf8')) as { id: string }
    expect(generalPersona.id).toBe('museai/basic-kit/general')

    const codingAgent = JSON.parse(readFileSync(join(root, 'agents/00000000-0000-4000-8000-000000000002/agent.json'), 'utf8')) as {
      personaId: string
      skillIds: string[]
    }
    expect(codingAgent.personaId).toBe('museai/basic-kit/coding')
    expect(codingAgent.skillIds).toEqual(['museai/basic-kit/git', 'museai/basic-kit/review'])
  })
})
