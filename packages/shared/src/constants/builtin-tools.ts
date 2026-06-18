import type { ToolDescriptor } from '../types/agent-api.js'

/** v0.1 内置工具目录（供 Web 组装 UI） */
export const BUILTIN_TOOL_DESCRIPTORS: readonly ToolDescriptor[] = [
  { name: 'read', description: '读取文件内容' },
  { name: 'ls', description: '列出目录' },
  { name: 'bash', description: '执行 Shell 命令' },
  { name: 'write', description: '写入文件' },
  { name: 'edit', description: '编辑文件' },
  { name: 'grep', description: '搜索文件内容（rg）' },
  { name: 'find', description: '查找文件（fd）' },
  { name: 'sleep', description: '阻塞等待（联调测试用）' },
] as const

export const BUILTIN_TOOL_NAMES = BUILTIN_TOOL_DESCRIPTORS.map(tool => tool.name)
