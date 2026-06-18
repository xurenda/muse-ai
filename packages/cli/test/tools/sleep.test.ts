import { describe, expect, it, vi } from 'vitest'
import { createSleepTool } from '@/tools/sleep.js'

describe('sleep tool', () => {
  it('应按秒数阻塞并返回耗时', async () => {
    const sleep = vi.fn(async () => {})
    const tool = createSleepTool('/tmp', { sleep })

    const result = await tool.execute('call-1', { seconds: 2, message: 'done' }, undefined)

    expect(sleep).toHaveBeenCalledWith(2000, undefined)
    expect(result.content[0]).toMatchObject({ type: 'text', text: expect.stringContaining('Slept') })
    expect(result.content[0]).toMatchObject({ type: 'text', text: expect.stringContaining('done') })
  })

  it('signal 中止时应抛错', async () => {
    const controller = new AbortController()
    const sleep = vi.fn(
      (_ms: number, signal?: AbortSignal) =>
        new Promise<void>((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new Error('Operation aborted')), { once: true })
        }),
    )
    const tool = createSleepTool('/tmp', { sleep })

    const pending = tool.execute('call-2', { seconds: 10 }, controller.signal)
    controller.abort()

    await expect(pending).rejects.toThrow(/Operation aborted/)
  })

  it('seconds 超出上限时应抛错', async () => {
    const tool = createSleepTool('/tmp', { maxSeconds: 5, sleep: async () => {} })

    await expect(tool.execute('call-3', { seconds: 6 }, undefined)).rejects.toThrow(/must not exceed 5/)
  })

  it('seconds 过小时应抛错', async () => {
    const tool = createSleepTool('/tmp', { sleep: async () => {} })

    await expect(tool.execute('call-4', { seconds: 0 }, undefined)).rejects.toThrow(/must be at least/)
  })
})
