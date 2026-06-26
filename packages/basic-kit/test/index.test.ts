import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getBasicKitPackageRoot, getBasicKitVersion } from '../src/index.js'

describe('@museai/basic-kit', () => {
  it('导出版本，且与 manifest 一致', () => {
    const root = getBasicKitPackageRoot()
    const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8')) as {
      id: string
      version: string
    }

    expect(getBasicKitVersion()).toBe('1.0.0')
    expect(manifest.id).toBe('museai/basic-kit')
    expect(manifest.version).toBe(getBasicKitVersion())
  })

  it('包内 persona/agent 不含 id、personaId（由目录 slug 推断）', () => {
    const root = getBasicKitPackageRoot()

    const generalPersona = JSON.parse(readFileSync(join(root, 'personas/general/persona.json'), 'utf8')) as Record<string, unknown>
    expect(generalPersona).not.toHaveProperty('id')
    expect(generalPersona.name).toBe('通用助手')

    const codingAgent = JSON.parse(readFileSync(join(root, 'agents/coding/agent.json'), 'utf8')) as {
      skillIds: string[]
    }
    expect(codingAgent).not.toHaveProperty('id')
    expect(codingAgent).not.toHaveProperty('personaId')
    expect(codingAgent.skillIds).toEqual(['git', 'review'])
  })
})
