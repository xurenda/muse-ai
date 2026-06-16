import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createGrepTool } from '@/tools/grep.js'
import { resolveRgPath, RG_NOT_FOUND_MESSAGE } from '@/tools/system-binary.js'

describe('grep tool', () => {
  it('未找到 rg 时抛错', async () => {
    const tool = createGrepTool('/tmp', { rgPath: null })
    await expect(tool.execute('call-1', { pattern: 'foo' })).rejects.toThrow(RG_NOT_FOUND_MESSAGE)
  })

  it('路径不存在时抛错', async () => {
    const tool = createGrepTool('/tmp', { rgPath: 'rg' })
    await expect(tool.execute('call-2', { pattern: 'foo', path: 'no-such-dir-muse-12345' })).rejects.toThrow(/Path not found/)
  })

  it('系统有 rg 时无匹配返回 No matches found', async () => {
    if (!resolveRgPath()) return

    const dir = await mkdtemp(join(tmpdir(), 'muse-grep-'))
    await writeFile(join(dir, 'sample.txt'), 'hello world\n', 'utf8')

    const tool = createGrepTool(dir)
    const result = await tool.execute('call-3', {
      pattern: '^MUSE_GREP_NOMATCH_UNIQUE_TOKEN$',
      path: '.',
      literal: true,
    })
    expect((result.content[0] as { type: 'text'; text: string }).text).toBe('No matches found')
  })
})
