import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

/** npm 包 SemVer 版本（与 manifest.json version 对齐） */
export function getBasicKitVersion(): string {
  const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as { version: string }
  return pkg.version
}

/** musepack 源码根目录（manifest.json + personas/skills/agents，与 zip 根布局一致） */
export function getBasicKitPackageRoot(): string {
  return packageRoot
}

/** 构建产物路径：`dist/museai-basic-kit-<version>.musepack` */
export function getBasicKitMusepackPath(): string {
  const version = getBasicKitVersion()
  return join(packageRoot, 'dist', `museai-basic-kit-${version}.musepack`)
}
