import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createEditTool } from '@/tools/edit.js'

describe('edit tool', () => {
  it('替换文件中的文本块', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'muse-edit-'))
    const filePath = join(dir, 'sample.ts')
    await writeFile(filePath, 'const a = 1;\nconst b = 2;\n', 'utf8')

    const tool = createEditTool(dir)
    const result = await tool.execute('call-1', {
      path: 'sample.ts',
      edits: [{ oldText: 'const b = 2;', newText: 'const b = 42;' }],
    })

    const updated = await readFile(filePath, 'utf8')
    expect(updated).toBe('const a = 1;\nconst b = 42;\n')
    expect(result.details?.diff).toBeDefined()
    expect((result.content[0] as { type: 'text'; text: string }).text).toContain('Successfully replaced')
  })

  it('支持 legacy oldText/newText 参数', async () => {
    const absolutePath = '/any/f.txt'
    const store = new Map<string, string>([[absolutePath, 'old-value']])
    const tool = createEditTool('/any', {
      operations: {
        access: async () => {},
        readFile: async path => Buffer.from(store.get(path) ?? '', 'utf8'),
        writeFile: async (path, content) => {
          store.set(path, content)
        },
      },
    })

    await tool.execute('call-2', {
      path: 'f.txt',
      oldText: 'old-value',
      newText: 'new-value',
    } as unknown as Parameters<typeof tool.execute>[1])

    expect(store.get(absolutePath)).toBe('new-value')
  })
})
