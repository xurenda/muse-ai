import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BASIC_KIT_PACKAGE_ID } from '@museai/shared'

export { BASIC_KIT_PACKAGE_ID }

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

/** npm 包 SemVer 版本（与 manifest.json version 对齐） */
export function getBasicKitVersion(): string {
  const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as { version: string }
  return pkg.version
}

/** 解压后对应 ~/.muse/ 的资产根目录（`assets/`） */
export function getBasicKitAssetsRoot(): string {
  return join(packageRoot, 'assets')
}

/** npm 包根目录（含 manifest.json、assets/） */
export function getBasicKitPackageRoot(): string {
  return packageRoot
}

export { packMusepack, type PackMusepackResult } from './pack-musepack.js'
