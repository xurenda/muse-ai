import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { inferAssetSource, type Persona, type SkillMeta } from '@museai/shared'
import type { MusePaths } from '../paths.js'

async function hasMuseOrigin(dir: string): Promise<boolean> {
  try {
    await access(join(dir, '.muse-origin.json'))
    return true
  } catch {
    return false
  }
}

function resolveAssetDir(paths: MusePaths, kind: 'personas' | 'skills', id: string): string {
  return join(paths[kind], ...id.split('/'))
}

/** 为 Persona 附加 `source` 字段（依据 id 与 `.muse-origin.json`） */
export async function enrichPersonaWithSource(paths: MusePaths, persona: Persona) {
  const dir = resolveAssetDir(paths, 'personas', persona.id)
  const source = inferAssetSource(persona.id, await hasMuseOrigin(dir))
  return { ...persona, source }
}

/** 为 Skill 附加 `source` 字段（依据 id 与 `.muse-origin.json`） */
export async function enrichSkillWithSource(paths: MusePaths, skill: SkillMeta) {
  const dir = resolveAssetDir(paths, 'skills', skill.id)
  const source = inferAssetSource(skill.id, await hasMuseOrigin(dir))
  return { ...skill, source }
}
