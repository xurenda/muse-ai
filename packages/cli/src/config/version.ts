import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

let cachedVersion: string | undefined

export function getCliVersion(): string {
  if (cachedVersion) {
    return cachedVersion
  }

  const packageRoot = dirname(fileURLToPath(import.meta.url))
  const packageJsonPath = join(packageRoot, '../../package.json')
  const raw = readFileSync(packageJsonPath, 'utf8')
  const parsed = JSON.parse(raw) as { version?: string }
  cachedVersion = parsed.version ?? '0.0.0'
  return cachedVersion
}
