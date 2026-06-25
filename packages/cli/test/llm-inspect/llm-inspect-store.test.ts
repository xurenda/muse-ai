import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clearSessionLlmInspectBuffer,
  flushSessionLlmInspectBuffer,
  getSessionLlmInspectBufferState,
  llmInspectBufferUpdateRequest,
  llmInspectBufferUpdateResponseMessage,
  llmInspectBufferUpdateResponseStatus,
  shouldCaptureLlmInspectTask,
} from '@/llm-inspect/llm-inspect-buffer.js'
import { deleteSessionLlmInspect, getSessionLlmInspect } from '@/llm-inspect/llm-inspect-store.js'

const previousMuseHome = process.env.MUSE_HOME

describe('llm-inspect-store', () => {
  let museHome = ''

  beforeEach(async () => {
    museHome = await mkdtemp(join(tmpdir(), 'muse-llm-inspect-test-'))
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

  it('无快照时返回空对象', async () => {
    const result = await getSessionLlmInspect('session-1')
    expect(result).toEqual({ sessionId: 'session-1' })
  })

  it('优先读取内存中的缓冲', async () => {
    const sessionId = 'session-live'
    llmInspectBufferUpdateRequest(sessionId, 'chat', { model: 'proxy', messages: [] })
    llmInspectBufferUpdateResponseStatus(sessionId, 200)
    llmInspectBufferUpdateResponseMessage(sessionId, {
      role: 'assistant',
      content: [{ type: 'text', text: 'hello' }],
      stopReason: 'stop',
    })

    const result = await getSessionLlmInspect(sessionId)
    expect(result.request?.task).toBe('chat')
    expect(result.request?.payload).toEqual({ model: 'proxy', messages: [] })
    expect(result.response?.status).toBe(200)
    expect(result.response?.message.stopReason).toBe('stop')
    expect(result.updatedAt).toBeTruthy()
  })

  it('flush 后从磁盘读取 request.json 与 response.json', async () => {
    const sessionId = 'session-flush'
    llmInspectBufferUpdateRequest(sessionId, 'compaction', { model: 'proxy' })
    llmInspectBufferUpdateResponseStatus(sessionId, 200)
    llmInspectBufferUpdateResponseMessage(sessionId, {
      role: 'assistant',
      content: [{ type: 'text', text: 'done' }],
      usage: { totalTokens: 10 },
      stopReason: 'stop',
    })

    await flushSessionLlmInspectBuffer(sessionId)
    clearSessionLlmInspectBuffer(sessionId)

    const inspectDir = join(museHome, 'llm-inspect', sessionId)
    const requestRaw = await readFile(join(inspectDir, 'request.json'), 'utf8')
    const responseRaw = await readFile(join(inspectDir, 'response.json'), 'utf8')

    expect(JSON.parse(requestRaw)).toMatchObject({
      task: 'compaction',
      payload: { model: 'proxy' },
    })
    expect(JSON.parse(responseRaw)).toMatchObject({
      status: 200,
      message: {
        stopReason: 'stop',
      },
    })

    const result = await getSessionLlmInspect(sessionId)
    expect(result.request?.task).toBe('compaction')
    expect(result.response?.message.stopReason).toBe('stop')
  })

  it('titleGeneration 不写入 inspect 缓冲', () => {
    const sessionId = 'session-title'
    llmInspectBufferUpdateRequest(sessionId, 'titleGeneration', { model: 'proxy' })
    llmInspectBufferUpdateResponseStatus(sessionId, 200)

    expect(shouldCaptureLlmInspectTask('titleGeneration')).toBe(false)
    expect(getSessionLlmInspectBufferState(sessionId)).toBeUndefined()
  })

  it('deleteSessionLlmInspect 删除目录与缓冲', async () => {
    const sessionId = 'session-delete'
    const inspectDir = join(museHome, 'llm-inspect', sessionId)
    await mkdir(inspectDir, { recursive: true })
    await writeFile(join(inspectDir, 'request.json'), '{}\n', 'utf8')
    llmInspectBufferUpdateRequest(sessionId, 'chat', { model: 'x' })

    await deleteSessionLlmInspect(sessionId)

    const result = await getSessionLlmInspect(sessionId)
    expect(result.request).toBeUndefined()
  })
})
