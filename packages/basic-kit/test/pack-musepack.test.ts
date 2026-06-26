import { readFileSync } from 'node:fs'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { unzipSync } from 'fflate'
import { packMusepack } from '../src/pack-musepack.js'
import { BASIC_KIT_PACKAGE_ID } from '../src/index.js'

describe('packMusepack', () => {
  it('生成可解压的 .musepack 且 manifest 合法', () => {
    const packageRoot = join(import.meta.dirname, '..')
    const outputDir = mkdtempSync(join(tmpdir(), 'muse-pack-'))
    try {
      const result = packMusepack({ packageRoot, outputDir })

      expect(result.packageId).toBe(BASIC_KIT_PACKAGE_ID)
      expect(result.version).toBe('1.0.0')
      expect(result.outputPath).toMatch(/museai-basic-kit-1\.0\.0\.musepack$/)

      const bytes = readFileSync(result.outputPath)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(result.sha256)

      const entries = unzipSync(bytes)
      expect(Object.keys(entries).sort()).toEqual(
        [
          'agents/00000000-0000-4000-8000-000000000001/agent.json',
          'agents/00000000-0000-4000-8000-000000000002/agent.json',
          'manifest.json',
          'personas/museai/basic-kit/coding/persona.json',
          'personas/museai/basic-kit/coding/system.md',
          'personas/museai/basic-kit/general/persona.json',
          'personas/museai/basic-kit/general/system.md',
          'skills/museai/basic-kit/git/SKILL.md',
          'skills/museai/basic-kit/review/SKILL.md',
        ].sort(),
      )

      const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json'])) as {
        id: string
        version: string
        kind: string
        assets: { type: string; id: string }[]
      }
      expect(manifest.id).toBe('museai/basic-kit')
      expect(manifest.kind).toBe('kit')
      expect(manifest.assets).toHaveLength(6)
      expect(manifest).not.toHaveProperty('sha256')
    } finally {
      rmSync(outputDir, { recursive: true, force: true })
    }
  })
})
