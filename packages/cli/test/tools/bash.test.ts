import { describe, expect, it } from 'vitest'
import { createBashTool } from '@/tools/bash.js'

describe('bash tool', () => {
  it('执行命令并返回 stdout', async () => {
    const tool = createBashTool(process.cwd(), {
      operations: {
        exec: async (_command, _cwd, { onData }) => {
          onData(Buffer.from('hello\n', 'utf8'))
          return { exitCode: 0 }
        },
      },
    })

    const result = await tool.execute('call-1', { command: 'echo hello' })
    expect(result.content[0]).toMatchObject({ type: 'text' })
    expect((result.content[0] as { type: 'text'; text: string }).text.trim()).toBe('hello')
  })

  it('非零退出码作为错误抛出', async () => {
    const tool = createBashTool(process.cwd(), {
      operations: {
        exec: async () => ({ exitCode: 1 }),
      },
    })

    await expect(tool.execute('call-2', { command: 'false' })).rejects.toThrow(/exited with code 1/)
  })

  it('timeout 参数触发超时错误', async () => {
    const tool = createBashTool(process.cwd(), {
      operations: {
        exec: async (_command, _cwd, { onData }) => {
          onData(Buffer.from('partial\n', 'utf8'))
          throw new Error('timeout:3')
        },
      },
    })

    await expect(tool.execute('call-3', { command: 'sleep 99', timeout: 3 })).rejects.toThrow(/timed out after 3 seconds/)
  })
})
