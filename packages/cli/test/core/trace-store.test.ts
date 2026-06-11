import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getSessionTrace, listSessionTraces } from '../../src/core/trace-store'

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

  it('列出空 trace 目录时返回空数组', async () => {
    const result = await listSessionTraces('session-1')
    expect(result).toEqual({ sessionId: 'session-1', traces: [] })
  })

  it('读取并解析 jsonl trace 文件', async () => {
    const sessionId = 'session-abc'
    const traceDir = join(museHome, 'trace', sessionId)
    await mkdir(traceDir, { recursive: true })
    await writeFile(
      join(traceDir, '0-trace.jsonl'),
      [
        JSON.stringify({ timestamp: '2026-06-11T00:00:00.000Z', turnIndex: 0, type: 'turn_start' }),
        JSON.stringify({ timestamp: '2026-06-11T00:00:01.000Z', turnIndex: 0, type: 'provider_request', payload: { model: 'gpt-4o' } }),
      ].join('\n') + '\n',
      'utf8',
    )

    const list = await listSessionTraces(sessionId)
    expect(list.traces).toHaveLength(1)
    expect(list.traces[0]?.turnIndex).toBe(0)
    expect(list.traces[0]?.entryCount).toBe(2)
    expect(list.traces[0]?.modelLabel).toBe('gpt-4o')

    const detail = await getSessionTrace(sessionId, 0)
    expect(detail.entries).toHaveLength(2)
    expect(detail.entries[1]?.type).toBe('provider_request')
  })

  it('trace 不存在时抛出错误', async () => {
    await expect(getSessionTrace('session-missing', 0)).rejects.toThrow('trace 不存在')
  })
})
