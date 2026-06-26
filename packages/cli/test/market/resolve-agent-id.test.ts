import { describe, expect, it } from 'vitest'
import { DEFAULT_AGENT_ID, DEFAULT_BASIC_KIT_AGENT_SLUG } from '@museai/shared'
import { basicKitAgentId, resolveAgentId } from '@/market/resolve-agent-id.js'
import { BASIC_KIT_PACKAGE_ID } from '@museai/shared'

describe('resolveAgentId', () => {
  it('同包同 slug 应得到稳定 UUID', () => {
    const a = resolveAgentId(BASIC_KIT_PACKAGE_ID, 'general')
    const b = resolveAgentId(BASIC_KIT_PACKAGE_ID, 'general')
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('DEFAULT_AGENT_ID 应对应 general slug', () => {
    expect(DEFAULT_AGENT_ID).toBe(resolveAgentId(BASIC_KIT_PACKAGE_ID, DEFAULT_BASIC_KIT_AGENT_SLUG))
  })
})

describe('basicKitAgentId', () => {
  it('应生成 basic-kit agent id', () => {
    expect(basicKitAgentId('coding')).toBe(resolveAgentId(BASIC_KIT_PACKAGE_ID, 'coding'))
  })
})
