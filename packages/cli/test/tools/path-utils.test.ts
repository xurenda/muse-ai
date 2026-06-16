import { describe, expect, it } from 'vitest'
import { resolveReadPath, resolveToCwd } from '@/tools/path-utils.js'
import { resolvePath } from '@/tools/paths.js'

describe('path-utils', () => {
  const cwd = '/tmp/project'

  it('resolveToCwd 解析相对路径', () => {
    expect(resolveToCwd('src/foo.ts', cwd)).toBe(resolvePath('src/foo.ts', cwd))
  })

  it('resolveToCwd 解析绝对路径', () => {
    expect(resolveToCwd('/etc/hosts', cwd)).toBe('/etc/hosts')
  })

  it('resolveToCwd 展开 ~', () => {
    const resolved = resolveToCwd('~/notes.txt', cwd)
    expect(resolved.endsWith('/notes.txt')).toBe(true)
    expect(resolved.startsWith('/')).toBe(true)
  })

  it('resolveReadPath 在文件不存在时返回解析路径', () => {
    const missing = resolveReadPath('definitely-missing-muse-file-12345.txt', cwd)
    expect(missing).toBe(resolvePath('definitely-missing-muse-file-12345.txt', cwd))
  })
})
