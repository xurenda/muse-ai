import { describe, expect, it } from 'vitest'
import { resolveFdPath, resolveRgPath } from '@/tools/system-binary.js'

describe('system-binary', () => {
  it('resolveRgPath 在 PATH 有 rg 时返回 rg', () => {
    const path = resolveRgPath()
    if (path) expect(path).toBe('rg')
  })

  it('resolveFdPath 在 PATH 有 fd 或 fdfind 时返回命令名', () => {
    const path = resolveFdPath()
    if (path) expect(['fd', 'fdfind']).toContain(path)
  })
})
