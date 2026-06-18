import type { AgentTool } from '@muse-ai/core'
import { createBashTool, type BashToolOptions } from '@/tools/bash.js'
import { createEditTool, type EditToolOptions } from '@/tools/edit.js'
import { createFindTool, type FindToolOptions } from '@/tools/find.js'
import { createGrepTool, type GrepToolOptions } from '@/tools/grep.js'
import { createLsTool, type LsToolOptions } from '@/tools/ls.js'
import { createReadTool, type ReadToolOptions } from '@/tools/read.js'
import { createSleepTool, type SleepToolOptions } from '@/tools/sleep.js'
import { createWriteTool, type WriteToolOptions } from '@/tools/write.js'

export type MuseToolName = 'read' | 'ls' | 'bash' | 'write' | 'edit' | 'grep' | 'find' | 'sleep'

export const MUSE_TOOL_NAMES: readonly MuseToolName[] = ['read', 'ls', 'bash', 'write', 'edit', 'grep', 'find', 'sleep'] as const

export const allToolNames = new Set<string>(MUSE_TOOL_NAMES)

export interface MuseToolsOptions {
  read?: ReadToolOptions
  ls?: LsToolOptions
  bash?: BashToolOptions
  write?: WriteToolOptions
  edit?: EditToolOptions
  grep?: GrepToolOptions
  find?: FindToolOptions
  sleep?: SleepToolOptions
}

/** 创建全部内置工具（按名称索引） */
export function createAllTools(cwd: string, options?: MuseToolsOptions): Record<MuseToolName, AgentTool> {
  return {
    read: createReadTool(cwd, options?.read),
    ls: createLsTool(cwd, options?.ls),
    bash: createBashTool(cwd, options?.bash),
    write: createWriteTool(cwd, options?.write),
    edit: createEditTool(cwd, options?.edit),
    grep: createGrepTool(cwd, options?.grep),
    find: createFindTool(cwd, options?.find),
    sleep: createSleepTool(cwd, options?.sleep),
  }
}

/** 按 Agent activeToolNames 解析可用工具列表；未知名称抛错 */
export function resolveActiveTools(activeToolNames: string[], cwd: string, options?: MuseToolsOptions): AgentTool[] {
  if (activeToolNames.length === 0) return []

  const allTools = createAllTools(cwd, options)
  const resolved: AgentTool[] = []

  for (const name of activeToolNames) {
    if (!(name in allTools)) {
      throw new Error(`未知内置工具: ${name}`)
    }
    resolved.push(allTools[name as MuseToolName])
  }

  return resolved
}

export {
  createReadTool,
  createLsTool,
  createBashTool,
  createWriteTool,
  createEditTool,
  createGrepTool,
  createFindTool,
  createSleepTool,
  type ReadToolOptions,
  type LsToolOptions,
  type BashToolOptions,
  type WriteToolOptions,
  type EditToolOptions,
  type GrepToolOptions,
  type FindToolOptions,
  type SleepToolOptions,
}
export { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, formatSize, truncateHead, truncateTail } from '@/tools/truncate.js'
export { resolveToCwd, resolveReadPath, resolveReadPathAsync } from '@/tools/path-utils.js'
export { withFileMutationQueue } from '@/tools/file-mutation-queue.js'
export { resolveRgPath, resolveFdPath, RG_NOT_FOUND_MESSAGE, FD_NOT_FOUND_MESSAGE } from '@/tools/system-binary.js'
