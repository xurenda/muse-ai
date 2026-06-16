import { accessSync, constants } from 'node:fs'
import { access } from 'node:fs/promises'
import { normalizePath, resolvePath } from '@/tools/paths.js'

const NARROW_NO_BREAK_SPACE = '\u202F'

function tryMacOsScreenshotPath(filePath: string): string {
  return filePath.replace(/ (AM|PM)\./gi, `${NARROW_NO_BREAK_SPACE}$1.`)
}

function tryNfdVariant(filePath: string): string {
  return filePath.normalize('NFD')
}

function tryCurlyQuoteVariant(filePath: string): string {
  return filePath.replace(/'/g, '\u2019')
}

function fileExists(filePath: string): boolean {
  try {
    accessSync(filePath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

export function resolveToCwd(filePath: string, cwd: string): string {
  return resolvePath(filePath, cwd, { normalizeUnicodeSpaces: true, stripAtPrefix: true })
}

async function resolveReadPathVariants(resolved: string): Promise<string> {
  if (await pathExists(resolved)) return resolved

  const variants = [tryMacOsScreenshotPath(resolved), tryNfdVariant(resolved), tryCurlyQuoteVariant(resolved), tryCurlyQuoteVariant(tryNfdVariant(resolved))]

  for (const variant of variants) {
    if (variant !== resolved && (await pathExists(variant))) {
      return variant
    }
  }

  return resolved
}

export async function resolveReadPathAsync(filePath: string, cwd: string): Promise<string> {
  const resolved = resolveToCwd(filePath, cwd)
  return resolveReadPathVariants(resolved)
}

export function resolveReadPath(filePath: string, cwd: string): string {
  const resolved = resolveToCwd(filePath, cwd)
  if (fileExists(resolved)) return resolved

  const variants = [tryMacOsScreenshotPath(resolved), tryNfdVariant(resolved), tryCurlyQuoteVariant(resolved), tryCurlyQuoteVariant(tryNfdVariant(resolved))]

  for (const variant of variants) {
    if (variant !== resolved && fileExists(variant)) {
      return variant
    }
  }

  return resolved
}

export function expandPath(filePath: string): string {
  return normalizePath(filePath, { normalizeUnicodeSpaces: true, stripAtPrefix: true })
}
