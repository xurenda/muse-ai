import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createReadTool } from '@/tools/read.js'

describe('read tool', () => {
  it('读取文本文件并支持 offset/limit', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'muse-read-'))
    const filePath = join(dir, 'sample.txt')
    await writeFile(filePath, 'line1\nline2\nline3\nline4\n', 'utf8')

    const tool = createReadTool(dir)
    const result = await tool.execute('call-1', { path: 'sample.txt', offset: 2, limit: 2 })

    const text = (result.content[0] as { type: 'text'; text: string }).text
    expect(text).toContain('line2')
    expect(text).toContain('line3')
  })

  it('offset 越界时抛错', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'muse-read-'))
    await writeFile(join(dir, 'a.txt'), 'only\n', 'utf8')
    const tool = createReadTool(dir)
    await expect(tool.execute('call-2', { path: 'a.txt', offset: 99 })).rejects.toThrow(/beyond end of file/)
  })

  it('可通过 Operations 注入 mock', async () => {
    const tool = createReadTool('/any', {
      operations: {
        access: async () => {},
        readFile: async () => Buffer.from('mocked\ncontent\n', 'utf8'),
      },
    })
    const result = await tool.execute('call-3', { path: 'virtual.txt' })
    const text = (result.content[0] as { type: 'text'; text: string }).text
    expect(text).toContain('mocked')
    expect(text).toContain('content')
  })
})
