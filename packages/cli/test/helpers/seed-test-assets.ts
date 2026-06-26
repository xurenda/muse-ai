import { cp, mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export function getCoreFixtureRoot(): string {
  return fileURLToPath(new URL('../../../core/test/fixtures', import.meta.url))
}

async function copyDirContents(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true })
  const entries = await readdir(src, { withFileTypes: true })
  await Promise.all(entries.map(entry => cp(join(src, entry.name), join(dest, entry.name), { recursive: true })))
}

/** 将 core 嵌套 fixture 复制到测试用 MUSE_HOME 子目录 */
export async function seedTestAssets(musePaths: { agents: string; personas: string; skills: string }): Promise<void> {
  const fixtureRoot = getCoreFixtureRoot()
  await copyDirContents(join(fixtureRoot, 'agents'), musePaths.agents)
  await copyDirContents(join(fixtureRoot, 'personas'), musePaths.personas)
  await copyDirContents(join(fixtureRoot, 'skills'), musePaths.skills)
}
