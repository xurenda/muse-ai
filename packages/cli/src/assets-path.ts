import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { MuseAssetRoots } from '@muse-ai/core'
import type { MusePaths } from './paths.js'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

/** CLI 包内只读内置资产根目录（dev 与 dist 均指向 packages/cli/assets） */
export function getBundledAssetsRoot(): string {
  return join(packageRoot, 'assets')
}

export function createAssetRoots(musePaths: MusePaths): MuseAssetRoots {
  const bundled = getBundledAssetsRoot()
  return {
    user: {
      agents: musePaths.agents,
      personas: musePaths.personas,
      skills: musePaths.skills,
    },
    bundled: {
      agents: join(bundled, 'agents'),
      personas: join(bundled, 'personas'),
      skills: join(bundled, 'skills'),
    },
  }
}
