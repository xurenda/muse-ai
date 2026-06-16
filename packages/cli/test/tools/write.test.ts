import { describe, expect, it } from 'vitest'
import { createWriteTool } from '@/tools/write.js'

describe('write tool', () => {
  it('写入文件内容', async () => {
    const writes: Array<{ path: string; content: string }> = []
    const mkdirs: string[] = []

    const tool = createWriteTool('/tmp', {
      operations: {
        mkdir: async dir => {
          mkdirs.push(dir)
        },
        writeFile: async (path, content) => {
          writes.push({ path, content })
        },
      },
    })

    const result = await tool.execute('call-1', { path: 'nested/out.txt', content: 'hello' })
    expect(mkdirs.length).toBe(1)
    expect(writes[0]?.content).toBe('hello')
    expect(result.content[0]?.type).toBe('text')
    expect((result.content[0] as { type: 'text'; text: string }).text).toContain('Successfully wrote')
  })

  it('abort 后抛错', async () => {
    const tool = createWriteTool('/tmp', {
      operations: {
        mkdir: async () => {},
        writeFile: async () => {},
      },
    })
    const controller = new AbortController()
    controller.abort()
    await expect(tool.execute('call-2', { path: 'a.txt', content: 'x' }, controller.signal)).rejects.toThrow(/aborted/i)
  })
})
