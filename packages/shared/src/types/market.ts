import { z } from 'zod'
import { marketSlugSchema, packageIdSchema, scopedAssetIdSchema } from '../schemas/market-id.js'

export const semverSchema = z.string().regex(/^\d+\.\d+\.\d+$/, '应为 MAJOR.MINOR.PATCH')

export const marketPackageKindSchema = z.enum(['persona', 'skill', 'kit'])

export const marketAssetTypeSchema = z.enum(['persona', 'skill', 'agent'])

export const marketAssetSchema = z.object({
  type: marketAssetTypeSchema,
  id: z.string().min(1),
})

export const agentTemplateSchema = z.object({
  name: z.string().min(1),
  personaId: scopedAssetIdSchema,
  skillIds: z.array(scopedAssetIdSchema),
  activeToolNames: z.array(z.string().min(1)).optional(),
  description: z.string().optional(),
})

export const marketManifestSchema = z
  .object({
    id: packageIdSchema,
    version: semverSchema,
    kind: marketPackageKindSchema,
    name: z.string().min(1),
    description: z.string().optional(),
    author: marketSlugSchema,
    assets: z.array(marketAssetSchema).min(1),
    agentTemplate: agentTemplateSchema.optional(),
    minMuseVersion: semverSchema.optional(),
  })
  .superRefine((manifest, ctx) => {
    const assets = manifest.assets

    if (manifest.kind !== 'kit' && assets.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '非 kit 包 manifest.assets 只能有 1 项',
        path: ['assets'],
      })
    }

    if (manifest.kind !== 'kit' && assets[0]?.id !== manifest.id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '单资产包 assets[0].id 必须等于 manifest.id',
        path: ['assets', 0, 'id'],
      })
    }

    for (const [index, asset] of assets.entries()) {
      if (asset.type === 'agent') {
        const parsed = z.string().uuid().safeParse(asset.id)
        if (!parsed.success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'agent 资产 id 应为 UUID',
            path: ['assets', index, 'id'],
          })
        }
        continue
      }

      const scoped = scopedAssetIdSchema.safeParse(asset.id)
      if (!scoped.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'persona/skill 资产 id 应为 scoped 路径',
          path: ['assets', index, 'id'],
        })
        continue
      }

      if (manifest.kind === 'kit' && !asset.id.startsWith(`${manifest.id}/`)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '套件内 persona/skill id 须以 packageId/ 为前缀',
          path: ['assets', index, 'id'],
        })
      }
    }
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
export type AgentTemplate = z.infer<typeof agentTemplateSchema>

/** 根据 id 与是否存在 .muse-origin.json 推断资产来源 */
export function inferAssetSource(assetId: string, hasMuseOrigin: boolean): AssetSource {
  if (assetId.startsWith('local/')) return 'local'
  return hasMuseOrigin ? 'market' : 'local'
}
