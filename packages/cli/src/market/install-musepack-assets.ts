import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { agentDefinitionSchema, museOriginSchema, personaSchema, scopeAssetId, type MarketAsset, type MarketManifest } from '@museai/shared'
import type { MusePaths } from '../paths.js'
import { resolveAgentId } from './resolve-agent-id.js'

const DEFAULT_ASSET_DIRS = {
  personas: 'personas',
  skills: 'skills',
  agents: 'agents',
} as const

function resolveManifestDirs(manifest: MarketManifest, extractDir: string): Record<'personas' | 'skills' | 'agents', string> {
  return {
    personas: join(extractDir, manifest.personas ?? DEFAULT_ASSET_DIRS.personas),
    skills: join(extractDir, manifest.skills ?? DEFAULT_ASSET_DIRS.skills),
    agents: join(extractDir, manifest.agents ?? DEFAULT_ASSET_DIRS.agents),
  }
}

const musepackPersonaSchema = personaSchema.omit({ id: true })
const musepackAgentSchema = agentDefinitionSchema.partial({
  id: true,
  personaId: true,
  createdAt: true,
  updatedAt: true,
})

function scopedDestRoot(paths: MusePaths, kind: 'personas' | 'skills', scopedId: string): string {
  return join(paths[kind], ...scopedId.split('/'))
}

function agentDestRoot(paths: MusePaths, agentId: string): string {
  return join(paths.agents, agentId)
}

async function listImmediateSubdirs(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    return entries.filter(entry => entry.isDirectory()).map(entry => entry.name)
  } catch {
    return []
  }
}

async function writeMuseOrigin(dir: string, manifest: MarketManifest, installedAt: string): Promise<void> {
  const origin = museOriginSchema.parse({
    packageId: manifest.id,
    packageVersion: manifest.version,
    installedAt,
  })
  await writeFile(join(dir, '.muse-origin.json'), `${JSON.stringify(origin, null, 2)}\n`, 'utf8')
}

async function installPersonaFromDir(paths: MusePaths, manifest: MarketManifest, srcDir: string, scopedId: string, installedAt: string): Promise<MarketAsset> {
  const raw = JSON.parse(await readFile(join(srcDir, 'persona.json'), 'utf8')) as unknown
  const persona = musepackPersonaSchema.parse(raw)
  const destDir = scopedDestRoot(paths, 'personas', scopedId)
  await rm(destDir, { recursive: true, force: true })
  await cp(srcDir, destDir, { recursive: true })
  await writeFile(join(destDir, 'persona.json'), `${JSON.stringify({ ...persona, id: scopedId }, null, 2)}\n`, 'utf8')
  await writeMuseOrigin(destDir, manifest, installedAt)
  return { type: 'persona', id: scopedId }
}

async function installSkillFromDir(paths: MusePaths, manifest: MarketManifest, srcDir: string, scopedId: string, installedAt: string): Promise<MarketAsset> {
  const destDir = scopedDestRoot(paths, 'skills', scopedId)
  await rm(destDir, { recursive: true, force: true })
  await cp(srcDir, destDir, { recursive: true })
  await writeMuseOrigin(destDir, manifest, installedAt)
  return { type: 'skill', id: scopedId }
}

async function installAgentFromDir(paths: MusePaths, srcDir: string, packageId: string, slug: string, installedAt: string): Promise<MarketAsset> {
  const raw = JSON.parse(await readFile(join(srcDir, 'agent.json'), 'utf8')) as unknown
  const parsed = musepackAgentSchema.parse(raw)

  const agentId = resolveAgentId(packageId, slug, parsed.id)
  const personaSlug = parsed.personaId ?? slug
  const agent = agentDefinitionSchema.parse({
    ...parsed,
    id: agentId,
    personaId: scopeAssetId(packageId, personaSlug),
    skillIds: parsed.skillIds.map(skillId => scopeAssetId(packageId, skillId)),
    createdAt: parsed.createdAt ?? installedAt,
    updatedAt: parsed.updatedAt ?? installedAt,
  })

  const destDir = agentDestRoot(paths, agent.id)
  await rm(destDir, { recursive: true, force: true })
  await mkdir(destDir, { recursive: true })
  await writeFile(join(destDir, 'agent.json'), `${JSON.stringify(agent, null, 2)}\n`, 'utf8')
  return { type: 'agent', id: agent.id }
}

async function installPersonas(paths: MusePaths, manifest: MarketManifest, personasDir: string, installedAt: string): Promise<MarketAsset[]> {
  const slugs = await listImmediateSubdirs(personasDir)
  if (slugs.length === 0) return []

  if (manifest.kind === 'persona') {
    const srcDir = join(personasDir, slugs[0]!)
    return [await installPersonaFromDir(paths, manifest, srcDir, manifest.id, installedAt)]
  }

  const assets: MarketAsset[] = []
  for (const slug of slugs) {
    const scopedId = scopeAssetId(manifest.id, slug)
    assets.push(await installPersonaFromDir(paths, manifest, join(personasDir, slug), scopedId, installedAt))
  }
  return assets
}

async function installSkills(paths: MusePaths, manifest: MarketManifest, skillsDir: string, installedAt: string): Promise<MarketAsset[]> {
  const slugs = await listImmediateSubdirs(skillsDir)
  if (slugs.length === 0) return []

  if (manifest.kind === 'skill') {
    const srcDir = join(skillsDir, slugs[0]!)
    return [await installSkillFromDir(paths, manifest, srcDir, manifest.id, installedAt)]
  }

  const assets: MarketAsset[] = []
  for (const slug of slugs) {
    const scopedId = scopeAssetId(manifest.id, slug)
    assets.push(await installSkillFromDir(paths, manifest, join(skillsDir, slug), scopedId, installedAt))
  }
  return assets
}

async function installAgents(paths: MusePaths, manifest: MarketManifest, agentsDir: string, installedAt: string): Promise<MarketAsset[]> {
  const slugs = await listImmediateSubdirs(agentsDir)
  const assets: MarketAsset[] = []
  for (const slug of slugs) {
    assets.push(await installAgentFromDir(paths, join(agentsDir, slug), manifest.id, slug, installedAt))
  }
  return assets
}

/** 将 musepack 解压目录中的简路径资产安装到 ~/.muse/，返回登记用资产列表 */
export async function installMusepackAssets(paths: MusePaths, manifest: MarketManifest, extractDir: string): Promise<MarketAsset[]> {
  const dirs = resolveManifestDirs(manifest, extractDir)
  const installedAt = new Date().toISOString()

  const personas = await installPersonas(paths, manifest, dirs.personas, installedAt)
  const skills = await installSkills(paths, manifest, dirs.skills, installedAt)
  const agents = await installAgents(paths, manifest, dirs.agents, installedAt)

  const assets = [...personas, ...skills, ...agents]
  if (assets.length === 0) {
    throw new Error('musepack 未包含可安装的 persona、skill 或 agent')
  }
  return assets
}
