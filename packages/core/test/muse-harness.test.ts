import { getModel } from '@earendil-works/pi-ai'
import { InMemorySessionRepo } from '@earendil-works/pi-agent-core'
import { describe, expect, it } from 'vitest'
import { MuseHarness, placeholderGetApiKeyAndHeaders } from '../src/index.js'

describe('MuseHarness', () => {
  it('应能构造并订阅事件', async () => {
    const repo = new InMemorySessionRepo()
    const session = await repo.create()
    const events: string[] = []

    const harness = new MuseHarness({
      cwd: process.cwd(),
      session,
      model: getModel('openai', 'gpt-4o-mini'),
      tools: [],
    })

    const unsubscribe = harness.subscribe(event => {
      events.push(event.type)
    })

    expect(harness.env.cwd).toBe(process.cwd())
    unsubscribe()
    expect(events).toEqual([])
  })
})

describe('placeholderGetApiKeyAndHeaders', () => {
  it('阶段 3 之前应返回 undefined', async () => {
    const result = await placeholderGetApiKeyAndHeaders(getModel('openai', 'gpt-4o-mini'))
    expect(result).toBeUndefined()
  })
})
