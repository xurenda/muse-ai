const STORAGE_KEY = 'muse:recent-workspaces'
const MAX_RECENT = 5

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  } catch {
    return []
  }
}

export function getRecentWorkspaces(): string[] {
  return readRecent()
}

export function addRecentWorkspace(path: string): void {
  const trimmed = path.trim()
  if (!trimmed) return

  const next = [trimmed, ...readRecent().filter((item) => item !== trimmed)].slice(0, MAX_RECENT)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}
