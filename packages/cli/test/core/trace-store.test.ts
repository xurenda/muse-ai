import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clearSessionTraceBuffer,
  flushSessionTraceBuffer,
  traceBufferUpdateRequest,
  traceBufferUpdateResponseMessage,
  traceBufferUpdateResponseStatus,
} from '../../src/core/trace-buffer'
import { deleteSessionTraces, getSessionTrace } from '../../src/core/trace-store'

const previousMuseHome = process.env.MUSE_HOME

describe('trace-store', () => {
  let museHome = ''

  beforeEach(async () => {
    museHome = await mkdtemp(join(tmpdir(), 'muse-trace-test-'))
    process.env.MUSE_HOME = museHome
  })

  afterEach(async () => {
    if (previousMuseHome === undefined) {
      delete process.env.MUSE_HOME
    } else {
      process.env.MUSE_HOME = previousMuseHome
    }
    await rm(museHome, { recursive: true, force: true })
  })

  it('无 trace 时返回空对象', async () => {
    const result = await getSessionTrace('session-1')
    expect(result).toEqual({ sessionId: 'session-1' })
  })

  it('优先读取内存中的 trace 缓冲', async () => {
    const sessionId = 'session-live'
    traceBufferUpdateRequest(sessionId, { model: 'gpt-4o', messages: [] })
    traceBufferUpdateResponseStatus(sessionId, 200)
    traceBufferUpdateResponseMessage(sessionId, {
      role: 'assistant',
      content: [{ type: 'text', text: 'hello' }],
      stopReason: 'stop',
    })

    const result = await getSessionTrace(sessionId)
    expect(result.request?.payload).toEqual({ model: 'gpt-4o', messages: [] })
    expect(result.response?.status).toBe(200)
    expect(result.response?.message.stopReason).toBe('stop')
    expect(result.updatedAt).toBeTruthy()
  })

  it('flush 后从磁盘读取 request.json 与 response.json', async () => {
    const sessionId = 'session-flush'
    traceBufferUpdateRequest(sessionId, { model: 'deepseek-v4-flash' })
    traceBufferUpdateResponseStatus(sessionId, 200)
    traceBufferUpdateResponseMessage(sessionId, {
      role: 'assistant',
      content: [{ type: 'text', text: 'done' }],
      usage: { totalTokens: 10 },
      stopReason: 'stop',
    })

    await flushSessionTraceBuffer(sessionId)
    clearSessionTraceBuffer(sessionId)

    const traceDir = join(museHome, 'traces', sessionId)
    const requestRaw = await readFile(join(traceDir, 'request.json'), 'utf8')
    const responseRaw = await readFile(join(traceDir, 'response.json'), 'utf8')

    expect(JSON.parse(requestRaw)).toMatchObject({
      payload: { model: 'deepseek-v4-flash' },
    })
    expect(JSON.parse(responseRaw)).toMatchObject({
      status: 200,
      message: {
        stopReason: 'stop',
      },
    })

    const result = await getSessionTrace(sessionId)
    expect(result.request?.payload).toEqual({ model: 'deepseek-v4-flash' })
    expect(result.response?.message.stopReason).toBe('stop')
  })

  it('deleteSessionTraces 删除 trace 目录与缓冲', async () => {
    const sessionId = 'session-delete'
    const traceDir = join(museHome, 'traces', sessionId)
    await mkdir(traceDir, { recursive: true })
    await writeFile(join(traceDir, 'request.json'), '{}\n', 'utf8')
    traceBufferUpdateRequest(sessionId, { model: 'x' })

    await deleteSessionTraces(sessionId)

    const result = await getSessionTrace(sessionId)
    expect(result.request).toBeUndefined()
  })
})
