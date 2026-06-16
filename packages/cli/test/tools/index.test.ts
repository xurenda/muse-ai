import { describe, expect, it } from 'vitest'
import { createAllTools, resolveActiveTools } from '@/tools/index.js'

describe('tools index', () => {
  it('createAllTools 返回 read/ls/bash', () => {
    const tools = createAllTools('/tmp')
    expect(Object.keys(tools).sort()).toEqual(['bash', 'edit', 'find', 'grep', 'ls', 'read', 'write'])
    expect(tools.read.name).toBe('read')
  })

  it('resolveActiveTools 按名称过滤', () => {
    const tools = resolveActiveTools(['read', 'bash'], '/tmp')
    expect(tools.map(t => t.name)).toEqual(['read', 'bash'])
  })

  it('resolveActiveTools 空列表返回空数组', () => {
    expect(resolveActiveTools([], '/tmp')).toEqual([])
  })

  it('未知工具名抛错', () => {
    expect(() => resolveActiveTools(['unknown'], '/tmp')).toThrow(/未知内置工具/)
  })
})
