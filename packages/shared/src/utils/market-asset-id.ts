import { BASIC_KIT_PACKAGE_ID } from '../constants/market.js'

/** 将包内 slug 或已 scoped 的 id 规范为 `{packageId}/{slug}` */
export function scopeAssetId(packageId: string, idOrSlug: string): string {
  if (idOrSlug.startsWith(`${packageId}/`)) return idOrSlug
  const segments = idOrSlug.split('/').filter(Boolean)
  if (segments.length === 1) return `${packageId}/${segments[0]}`
  return idOrSlug
}

/** `museai/basic-kit` 内 persona/skill scoped id 简写 */
export function basicKitAssetId(slug: string): string {
  return scopeAssetId(BASIC_KIT_PACKAGE_ID, slug)
}
