import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import bcrypt from 'bcryptjs'
import { getBasicKitPackageRoot, packMusepack } from '@museai/basic-kit'
import { marketManifestSchema } from '@museai/shared'
import { and, eq } from 'drizzle-orm'
import type { MuseDb } from '../db/client.js'
import { marketPackageVersions, marketPackages, users } from '../db/schema.js'
import { installBlobFile } from './blob-store.js'

const MUSEAI_SEED_EMAIL = 'museai@muse.ai'
const MUSEAI_SEED_USERNAME = 'museai'

/** 确保官方账号与市场种子包存在（幂等） */
export async function seedMarketData(db: MuseDb, marketDataDir: string): Promise<void> {
  const authorId = await ensureMuseaiUser(db)
  await ensureBasicKitPackage(db, marketDataDir, authorId)
}

async function ensureMuseaiUser(db: MuseDb): Promise<string> {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, MUSEAI_SEED_USERNAME)).limit(1)
  if (existing) return existing.id

  const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10)
  const [row] = await db
    .insert(users)
    .values({
      email: MUSEAI_SEED_EMAIL,
      username: MUSEAI_SEED_USERNAME,
      passwordHash,
      isAdmin: true,
    })
    .returning({ id: users.id })

  if (!row) throw new Error('种子用户 museai 创建失败')
  return row.id
}

async function ensureBasicKitPackage(db: MuseDb, marketDataDir: string, authorId: string): Promise<void> {
  const packageRoot = getBasicKitPackageRoot()
  const manifest = marketManifestSchema.parse(JSON.parse(readFileSync(`${packageRoot}/manifest.json`, 'utf8')) as unknown)

  const [existingPackage] = await db.select().from(marketPackages).where(eq(marketPackages.id, manifest.id)).limit(1)
  if (!existingPackage) {
    await db.insert(marketPackages).values({
      id: manifest.id,
      authorId,
      kind: manifest.kind,
      name: manifest.name,
      description: manifest.description,
      status: 'published',
    })
  }

  const [existingVersion] = await db
    .select()
    .from(marketPackageVersions)
    .where(and(eq(marketPackageVersions.packageId, manifest.id), eq(marketPackageVersions.version, manifest.version)))
    .limit(1)

  if (existingVersion) {
    return
  }

  const packed = packMusepack({ packageRoot })
  const blobPath = await installBlobFile(marketDataDir, manifest.id, manifest.version, packed.outputPath)

  await db.insert(marketPackageVersions).values({
    packageId: manifest.id,
    version: manifest.version,
    manifestJson: JSON.stringify(manifest),
    sha256: packed.sha256,
    blobPath,
  })
}
