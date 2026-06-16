import { describe, expect, it } from 'vitest'
import { withFileMutationQueue } from '@/tools/file-mutation-queue.js'

describe('file-mutation-queue', () => {
  it('同一文件路径的操作串行执行', async () => {
    const order: number[] = []
    const file = `/tmp/muse-queue-test-${Date.now()}.txt`

    const first = withFileMutationQueue(file, async () => {
      order.push(1)
      await new Promise(resolve => setTimeout(resolve, 30))
      order.push(2)
    })

    const second = withFileMutationQueue(file, async () => {
      order.push(3)
    })

    await Promise.all([first, second])
    expect(order).toEqual([1, 2, 3])
  })
})
