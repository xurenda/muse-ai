/** 构建市场包详情页路径：`/market/museai/basic-kit` */
export function marketPackagePath(packageId: string): string {
  return `/market/${packageId
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/')}`
}

/** 从 React Router splat 解析 packageId */
export function parseMarketPackageIdFromSplat(splat: string | undefined): string | null {
  if (!splat || splat === 'installed') return null
  return splat
    .split('/')
    .map(segment => decodeURIComponent(segment))
    .join('/')
}
