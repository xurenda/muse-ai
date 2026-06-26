import type {
  MarketInstallUrlResponse,
  MarketPackageDetail,
  MarketPackageKind,
  MarketPackageListResponse,
  MarketPackageSummary,
  MarketManifest,
} from '@museai/shared'
import { compareSemver, marketDownloadPath, marketManifestSchema, pickLatestSemver } from '@museai/shared'
import { and, eq, ilike, or } from 'drizzle-orm'
import type { MuseDb } from '../db/client.js'
import { marketPackageVersions, marketPackages, users } from '../db/schema.js'
import { assertBlobExists } from './blob-store.js'

export interface MarketListQuery {
  kind?: MarketPackageKind
  author?: string
  q?: string
}

export interface MarketServiceOptions {
  marketDataDir: string
  publicBaseUrl: string
}

export class MarketError extends Error {
  constructor(
    readonly code: 'package_not_found' | 'version_not_found' | 'blob_not_found',
    message: string,
  ) {
    super(message)
    this.name = 'MarketError'
  }
}

export class MarketService {
  constructor(
    private readonly db: MuseDb,
    private readonly options: MarketServiceOptions,
  ) {}

  async listPublishedPackages(query: MarketListQuery = {}): Promise<MarketPackageListResponse> {
    const conditions = [eq(marketPackages.status, 'published')]
    if (query.kind) {
      conditions.push(eq(marketPackages.kind, query.kind))
    }
    if (query.author) {
      conditions.push(eq(users.username, query.author.toLowerCase()))
    }
    if (query.q?.trim()) {
      const pattern = `%${query.q.trim()}%`
      conditions.push(or(ilike(marketPackages.name, pattern), ilike(marketPackages.description, pattern))!)
    }

    const rows = await this.db
      .select({
        pkg: marketPackages,
        author: users.username,
      })
      .from(marketPackages)
      .innerJoin(users, eq(marketPackages.authorId, users.id))
      .where(and(...conditions))

    const packages: MarketPackageSummary[] = []
    for (const row of rows) {
      const summary = await this.buildPackageSummary(row.pkg, row.author)
      if (summary) packages.push(summary)
    }

    packages.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    return { packages }
  }

  async getPackageDetail(packageId: string): Promise<MarketPackageDetail> {
    const pkg = await this.getPublishedPackage(packageId)
    const versions = await this.listPackageVersions(packageId)
    const latestVersion = pickLatestSemver(versions.map(item => item.version))
    if (!latestVersion) {
      throw new MarketError('version_not_found', '市场包无可用版本')
    }

    const latestRow = versions.find(item => item.version === latestVersion)
    if (!latestRow) {
      throw new MarketError('version_not_found', '市场包无可用版本')
    }

    const summary = await this.buildPackageSummary(pkg.row.pkg, pkg.row.author, latestVersion)
    if (!summary) {
      throw new MarketError('version_not_found', '市场包无可用版本')
    }

    return {
      ...summary,
      versions: versions.map(item => ({ version: item.version, createdAt: item.createdAt })).sort((a, b) => compareSemver(b.version, a.version)),
      manifest: marketManifestSchema.parse(latestRow.manifest),
    }
  }

  async createInstallUrl(packageId: string, requestedVersion?: string): Promise<MarketInstallUrlResponse> {
    await this.getPublishedPackage(packageId)
    const versionRow = await this.resolveVersionRow(packageId, requestedVersion)
    const downloadUrl = `${this.options.publicBaseUrl.replace(/\/$/, '')}${marketDownloadPath(packageId, versionRow.version)}`

    try {
      await assertBlobExists(this.options.marketDataDir, versionRow.blobPath)
    } catch {
      throw new MarketError('blob_not_found', '市场包文件不存在')
    }

    return {
      packageId,
      version: versionRow.version,
      sha256: versionRow.sha256,
      downloadUrl,
    }
  }

  async getPublishedVersionBlob(packageId: string, version: string): Promise<{ absolutePath: string; sha256: string }> {
    await this.getPublishedPackage(packageId)
    const versionRow = await this.resolveVersionRow(packageId, version)

    try {
      const absolutePath = await assertBlobExists(this.options.marketDataDir, versionRow.blobPath)
      return { absolutePath, sha256: versionRow.sha256 }
    } catch {
      throw new MarketError('blob_not_found', '市场包文件不存在')
    }
  }

  private async getPublishedPackage(packageId: string) {
    const [row] = await this.db
      .select({
        pkg: marketPackages,
        author: users.username,
      })
      .from(marketPackages)
      .innerJoin(users, eq(marketPackages.authorId, users.id))
      .where(eq(marketPackages.id, packageId))
      .limit(1)

    if (!row || row.pkg.status !== 'published') {
      throw new MarketError('package_not_found', '市场包不存在')
    }

    return { row }
  }

  private async listPackageVersions(packageId: string) {
    const rows = await this.db
      .select({
        version: marketPackageVersions.version,
        createdAt: marketPackageVersions.createdAt,
        manifestJson: marketPackageVersions.manifestJson,
        sha256: marketPackageVersions.sha256,
        blobPath: marketPackageVersions.blobPath,
      })
      .from(marketPackageVersions)
      .where(eq(marketPackageVersions.packageId, packageId))

    return rows.map(row => ({
      version: row.version,
      createdAt: row.createdAt,
      sha256: row.sha256,
      blobPath: row.blobPath,
      manifest: marketManifestSchema.parse(JSON.parse(row.manifestJson) as unknown),
    }))
  }

  private async resolveVersionRow(packageId: string, requestedVersion?: string) {
    const versions = await this.listPackageVersions(packageId)
    if (versions.length === 0) {
      throw new MarketError('version_not_found', '市场包无可用版本')
    }

    if (requestedVersion) {
      const matched = versions.find(item => item.version === requestedVersion)
      if (!matched) {
        throw new MarketError('version_not_found', '指定版本不存在')
      }
      return matched
    }

    const latestVersion = pickLatestSemver(versions.map(item => item.version))
    const latest = versions.find(item => item.version === latestVersion)
    if (!latest) {
      throw new MarketError('version_not_found', '市场包无可用版本')
    }
    return latest
  }

  private async buildPackageSummary(
    pkg: typeof marketPackages.$inferSelect,
    author: string,
    latestVersionOverride?: string,
  ): Promise<MarketPackageSummary | null> {
    const versionRows = await this.db
      .select({ version: marketPackageVersions.version })
      .from(marketPackageVersions)
      .where(eq(marketPackageVersions.packageId, pkg.id))

    const latestVersion = latestVersionOverride ?? pickLatestSemver(versionRows.map(row => row.version))
    if (!latestVersion) return null

    return {
      id: pkg.id,
      kind: pkg.kind as MarketPackageKind,
      name: pkg.name,
      description: pkg.description ?? undefined,
      author,
      status: 'published',
      latestVersion,
      updatedAt: pkg.updatedAt,
    }
  }
}

export type { MarketManifest }
