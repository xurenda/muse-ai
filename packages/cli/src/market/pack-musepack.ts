import { createHash } from 'node:crypto'
import { lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getBasicKitPackageRoot } from '@museai/basic-kit'
import { MUSEPACK_MAX_BYTES, marketManifestSchema } from '@museai/shared'
import { zipSync } from 'fflate'

const DEFAULT_ASSET_DIRS = {
  personas: 'personas',
  skills: 'skills',
  agents: 'agents',
} as const

function normalizeManifestRelPath(path: string): string {
  return path.replace(/^\.\//, '')
}

export interface PackMusepackResult {
  outputPath: string
  sha256: string
  packageId: string
  version: string
  sizeBytes: number
}

export interface PackMusepackOptions {
  /** musepack 源码根目录（含 manifest.json 与 personas/skills/agents） */
  packageRoot: string
  /** 输出目录，默认 packageRoot/dist */
  outputDir?: string
}

function collectAssetFiles(packageRoot: string, relPath: string, zipPrefix: string, into: Record<string, Uint8Array>): void {
  const kindRoot = join(packageRoot, relPath)
  let kindStat
  try {
    kindStat = lstatSync(kindRoot)
  } catch {
    return
  }
  if (!kindStat.isDirectory()) {
    throw new Error(`资产目录应为文件夹: ${kindRoot}`)
  }

  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name)
      const stat = lstatSync(fullPath)
      if (stat.isSymbolicLink()) {
        throw new Error(`拒绝 symlink: ${fullPath}`)
      }
      const zipPath = posix.join(prefix, entry.name)
      if (stat.isDirectory()) {
        walk(fullPath, zipPath)
        continue
      }
      if (!stat.isFile()) {
        throw new Error(`不支持的文件类型: ${fullPath}`)
      }
      into[zipPath] = readFileSync(fullPath)
    }
  }

  walk(kindRoot, zipPrefix)
}

/** 将 musepack 源码目录打成 .musepack（zip），返回路径与 sha256 */
export function packMusepack(options: PackMusepackOptions): PackMusepackResult {
  const packageRoot = options.packageRoot
  const outputDir = options.outputDir ?? join(packageRoot, 'dist')
  const manifestPath = join(packageRoot, 'manifest.json')
  const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as { version: string }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    id: string
    version: string
    kind: string
  }

  if (manifest.version !== pkg.version) {
    throw new Error(`manifest.version (${manifest.version}) 与 package.json version (${pkg.version}) 不一致`)
  }
  if (!manifest.id || !manifest.version || !manifest.kind) {
    throw new Error('manifest.json 缺少必要字段')
  }

  const manifestParsed = marketManifestSchema.safeParse(manifest)
  if (!manifestParsed.success) {
    throw new Error(`manifest.json 校验失败: ${manifestParsed.error.message}`)
  }

  const files: Record<string, Uint8Array> = {
    'manifest.json': readFileSync(manifestPath),
  }

  const parsedManifest = manifestParsed.data
  const assetDirs = [
    normalizeManifestRelPath(parsedManifest.personas ?? DEFAULT_ASSET_DIRS.personas),
    normalizeManifestRelPath(parsedManifest.skills ?? DEFAULT_ASSET_DIRS.skills),
    normalizeManifestRelPath(parsedManifest.agents ?? DEFAULT_ASSET_DIRS.agents),
  ]
  for (const rel of assetDirs) {
    collectAssetFiles(packageRoot, rel, rel, files)
  }

  const zipped = zipSync(files, { level: 9 })
  if (zipped.byteLength > MUSEPACK_MAX_BYTES) {
    throw new Error(`包体积超过 ${MUSEPACK_MAX_BYTES} 字节: ${zipped.byteLength}`)
  }

  const sha256 = createHash('sha256').update(zipped).digest('hex')
  const outputName = `${manifest.id.replaceAll('/', '-')}-${manifest.version}.musepack`
  mkdirSync(outputDir, { recursive: true })
  const outputPath = join(outputDir, outputName)
  writeFileSync(outputPath, zipped)

  return {
    outputPath,
    sha256,
    packageId: manifest.id,
    version: manifest.version,
    sizeBytes: zipped.byteLength,
  }
}

const isMain = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]

if (isMain) {
  const packageRoot = process.argv[2]?.trim() || getBasicKitPackageRoot()
  const result = packMusepack({ packageRoot })
  console.log(`已生成: ${result.outputPath}`)
  console.log(`sha256: ${result.sha256}`)
  console.log(`大小: ${result.sizeBytes} 字节`)
}
