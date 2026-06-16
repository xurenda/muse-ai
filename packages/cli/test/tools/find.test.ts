import { describe, expect, it } from 'vitest'
import { createFindTool } from '@/tools/find.js'
import { FD_NOT_FOUND_MESSAGE } from '@/tools/system-binary.js'

describe('find tool', () => {
  it('未找到 fd 时抛错', async () => {
    const tool = createFindTool('/tmp', { fdPath: null })
    await expect(tool.execute('call-1', { pattern: '*.ts' })).rejects.toThrow(FD_NOT_FOUND_MESSAGE)
  })

  it('可通过 operations.glob 注入结果', async () => {
    const tool = createFindTool('/tmp', {
      operations: {
        exists: async () => true,
        glob: async () => ['src/a.ts', 'src/b.ts'],
      },
    })

    const result = await tool.execute('call-2', { pattern: '**/*.ts' })
    const text = (result.content[0] as { type: 'text'; text: string }).text
    expect(text).toContain('src/a.ts')
    expect(text).toContain('src/b.ts')
  })

  it('glob 无结果时返回提示', async () => {
    const tool = createFindTool('/tmp', {
      operations: {
        exists: async () => true,
        glob: async () => [],
      },
    })

    const result = await tool.execute('call-3', { pattern: '*.missing' })
    expect((result.content[0] as { type: 'text'; text: string }).text).toBe('No files found matching pattern')
  })
})
