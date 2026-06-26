import { z } from 'zod'
import { marketSlugSchema, packageIdSchema } from '../schemas/market-id.js'

export const semverSchema = z.string().regex(/^\d+\.\d+\.\d+$/, '应为 MAJOR.MINOR.PATCH')

export const marketPackageKindSchema = z.enum(['persona', 'skill', 'kit'])

export const marketAssetTypeSchema = z.enum(['persona', 'skill', 'agent'])

export const marketAssetSchema = z.object({
  type: marketAssetTypeSchema,
  id: z.string().min(1),
})

/** musepack 内资产目录相对路径（默认 personas / skills / agents） */
export const marketManifestSchema = z.object({
  id: packageIdSchema,
  version: semverSchema,
  kind: marketPackageKindSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  author: marketSlugSchema,
  personas: z.string().min(1).optional(),
  skills: z.string().min(1).optional(),
  agents: z.string().min(1).optional(),
  minMuseVersion: semverSchema.optional(),
})

export const museOriginSchema = z.object({
  packageId: packageIdSchema,
  packageVersion: semverSchema,
  installedAt: z.string().datetime(),
})

export const installedPackageSchema = z.object({
  version: semverSchema,
  installedAt: z.string().datetime(),
  assets: z.array(marketAssetSchema).min(1),
})

export const installedPackagesFileSchema = z.object({
  packages: z.record(packageIdSchema, installedPackageSchema),
})

export const assetSourceSchema = z.enum(['local', 'market'])

export type MarketPackageKind = z.infer<typeof marketPackageKindSchema>
export type MarketAsset = z.infer<typeof marketAssetSchema>
export type MarketManifest = z.infer<typeof marketManifestSchema>
export type MuseOrigin = z.infer<typeof museOriginSchema>
export type InstalledPackage = z.infer<typeof installedPackageSchema>
export type InstalledPackagesFile = z.infer<typeof installedPackagesFileSchema>
export type AssetSource = z.infer<typeof assetSourceSchema>

/** 根据 id 与是否存在 .muse-origin.json 推断资产来源 */
export function inferAssetSource(assetId: string, hasMuseOrigin: boolean): AssetSource {
  if (assetId.startsWith('local/')) return 'local'
  return hasMuseOrigin ? 'market' : 'local'
}
