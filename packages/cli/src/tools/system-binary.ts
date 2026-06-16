import { spawnSync } from 'node:child_process'

function commandExists(cmd: string): boolean {
  try {
    const result = spawnSync(cmd, ['--version'], { stdio: 'pipe' })
    return result.error === undefined || result.error === null
  } catch {
    return false
  }
}

/** 解析系统 PATH 中的 ripgrep；未找到返回 null */
export function resolveRgPath(): string | null {
  if (commandExists('rg')) return 'rg'
  return null
}

/** 解析系统 PATH 中的 fd（Debian/Ubuntu 可能为 fdfind） */
export function resolveFdPath(): string | null {
  if (commandExists('fd')) return 'fd'
  if (commandExists('fdfind')) return 'fdfind'
  return null
}

export const RG_NOT_FOUND_MESSAGE = 'ripgrep (rg) not found in PATH. Install it (e.g. brew install ripgrep) and retry.'

export const FD_NOT_FOUND_MESSAGE = 'fd not found in PATH. Install it (e.g. brew install fd) and retry. On Debian/Ubuntu the binary may be named fdfind.'
