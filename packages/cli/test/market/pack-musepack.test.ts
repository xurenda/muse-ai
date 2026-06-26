import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { unzipSync } from 'fflate'
import { getBasicKitPackageRoot } from '@museai/basic-kit'
import { BASIC_KIT_PACKAGE_ID } from '@museai/shared'
import { packMusepack } from '@/market/pack-musepack.js'

describe('packMusepack', () => {
  it('应从 musepack 源码目录生成可解压的 .musepack', () => {
    const packageRoot = getBasicKitPackageRoot()
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
          'agents/coding/agent.json',
          'agents/general/agent.json',
          'manifest.json',
          'personas/coding/persona.json',
          'personas/coding/system.md',
          'personas/general/persona.json',
          'personas/general/system.md',
          'skills/git/SKILL.md',
          'skills/review/SKILL.md',
        ].sort(),
      )

      const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json'])) as {
        id: string
        version: string
        kind: string
      }
      expect(manifest.id).toBe('museai/basic-kit')
      expect(manifest.kind).toBe('kit')
      expect(manifest).not.toHaveProperty('assets')
      expect(manifest).not.toHaveProperty('sha256')
    } finally {
      rmSync(outputDir, { recursive: true, force: true })
    }
  })
})
