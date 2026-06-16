import { mkdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createLsTool } from '@/tools/ls.js'

describe('ls tool', () => {
  it('列出目录并按字母排序', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'muse-ls-'))
    await mkdir(join(dir, 'beta'))
    await mkdir(join(dir, 'Alpha'))

    const tool = createLsTool(dir)
    const result = await tool.execute('call-1', { path: '.' })

    expect(result.content[0]?.type).toBe('text')
    const text = (result.content[0] as { type: 'text'; text: string }).text
    expect(text).toContain('Alpha/')
    expect(text).toContain('beta/')
    expect(text.indexOf('Alpha')).toBeLessThan(text.indexOf('beta'))
  })

  it('非目录路径抛错', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'muse-ls-'))
    const tool = createLsTool(dir)
    await expect(tool.execute('call-2', { path: '/etc/hosts' })).rejects.toThrow(/Not a directory/)
  })
})
