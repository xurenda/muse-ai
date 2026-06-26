import { z } from 'zod'
import { marketSlugSchema, packageIdSchema } from '../schemas/market-id.js'
import { marketManifestSchema, marketPackageKindSchema, semverSchema } from './market.js'

export const marketPackageStatusSchema = z.enum(['published', 'draft', 'pending', 'rejected'])

export const marketPackageSummarySchema = z.object({
  id: packageIdSchema,
  kind: marketPackageKindSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  author: marketSlugSchema,
  status: marketPackageStatusSchema,
  latestVersion: semverSchema,
  updatedAt: z.string(),
})

export const marketPackageVersionSummarySchema = z.object({
  version: semverSchema,
  createdAt: z.string(),
})

export const marketPackageDetailSchema = marketPackageSummarySchema.extend({
  versions: z.array(marketPackageVersionSummarySchema),
  manifest: marketManifestSchema,
})

export const marketPackageListResponseSchema = z.object({
  packages: z.array(marketPackageSummarySchema),
})

export const marketInstallUrlRequestSchema = z.object({
  version: semverSchema.optional(),
})

export const marketInstallUrlResponseSchema = z.object({
  packageId: packageIdSchema,
  version: semverSchema,
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  downloadUrl: z.string().url(),
})

export type MarketPackageStatus = z.infer<typeof marketPackageStatusSchema>
export type MarketPackageSummary = z.infer<typeof marketPackageSummarySchema>
export type MarketPackageVersionSummary = z.infer<typeof marketPackageVersionSummarySchema>
export type MarketPackageDetail = z.infer<typeof marketPackageDetailSchema>
export type MarketPackageListResponse = z.infer<typeof marketPackageListResponseSchema>
export type MarketInstallUrlRequest = z.infer<typeof marketInstallUrlRequestSchema>
export type MarketInstallUrlResponse = z.infer<typeof marketInstallUrlResponseSchema>

/** 构建市场包详情路径：`GET /market/packages/museai/basic-kit` */
export function marketPackageDetailPath(packageId: string): string {
  const segments = packageId.split('/').map(segment => encodeURIComponent(segment))
  return `/market/packages/${segments.join('/')}`
}

/** 构建 install-url 路径：`POST /market/packages/museai/basic-kit/install-url` */
export function marketPackageInstallUrlPath(packageId: string): string {
  return `${marketPackageDetailPath(packageId)}/install-url`
}

/** 构建下载路径：`GET /market/download/museai/basic-kit/1.0.0` */
export function marketDownloadPath(packageId: string, version: string): string {
  const segments = packageId.split('/').map(segment => encodeURIComponent(segment))
  return `/market/download/${segments.join('/')}/${encodeURIComponent(version)}`
}
