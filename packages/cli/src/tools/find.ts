import { createInterface } from 'node:readline'
import { spawn } from 'node:child_process'
import nodePath from 'node:path'
import type { AgentTool } from '@museai/core'
import { Type, type Static } from 'typebox'
import { pathExists, resolveToCwd } from '@/tools/path-utils.js'
import { FD_NOT_FOUND_MESSAGE, resolveFdPath } from '@/tools/system-binary.js'
import { DEFAULT_MAX_BYTES, formatSize, type TruncationResult, truncateHead } from '@/tools/truncate.js'

function toPosixPath(value: string): string {
  return value.split(nodePath.sep).join('/')
}

const findSchema = Type.Object({
  pattern: Type.String({
    description: "Glob pattern to match files, e.g. '*.ts', '**/*.json', or 'src/**/*.spec.ts'",
  }),
  path: Type.Optional(Type.String({ description: 'Directory to search in (default: current directory)' })),
  limit: Type.Optional(Type.Number({ description: 'Maximum number of results (default: 1000)' })),
})

export type FindToolInput = Static<typeof findSchema>
const DEFAULT_LIMIT = 1000

export interface FindToolDetails {
  truncation?: TruncationResult
  resultLimitReached?: number
}

export interface FindOperations {
  exists: (absolutePath: string) => Promise<boolean> | boolean
  glob: (pattern: string, cwd: string, options: { ignore: string[]; limit: number }) => Promise<string[]> | string[]
}

const defaultFindOperations: FindOperations = {
  exists: pathExists,
  glob: () => [],
}

export interface FindToolOptions {
  operations?: FindOperations
  /** 测试注入；默认从 PATH 解析 fd / fdfind */
  fdPath?: string | null
}

export function createFindTool(cwd: string, options?: FindToolOptions): AgentTool<typeof findSchema> {
  const customOps = options?.operations

  return {
    name: 'find',
    label: 'find',
    description: `Search for files by glob pattern. Returns matching file paths relative to the search directory. Respects .gitignore. Output is truncated to ${DEFAULT_LIMIT} results or ${DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first).`,
    parameters: findSchema,
    async execute(_toolCallId, { pattern, path: searchDir, limit }, signal) {
      if (signal?.aborted) throw new Error('Operation aborted')

      const searchPath = resolveToCwd(searchDir || '.', cwd)
      const effectiveLimit = limit ?? DEFAULT_LIMIT
      const ops = customOps ?? defaultFindOperations

      if (customOps?.glob) {
        if (!(await ops.exists(searchPath))) {
          throw new Error(`Path not found: ${searchPath}`)
        }
        if (signal?.aborted) throw new Error('Operation aborted')

        const results = await ops.glob(pattern, searchPath, {
          ignore: ['**/node_modules/**', '**/.git/**'],
          limit: effectiveLimit,
        })
        if (signal?.aborted) throw new Error('Operation aborted')

        if (results.length === 0) {
          return { content: [{ type: 'text', text: 'No files found matching pattern' }], details: undefined }
        }

        const relativized = results.map(p => {
          if (p.startsWith(searchPath)) return toPosixPath(p.slice(searchPath.length + 1))
          return toPosixPath(nodePath.relative(searchPath, p))
        })

        return formatFindOutput(relativized, effectiveLimit)
      }

      const fdPath = options?.fdPath !== undefined ? options.fdPath : resolveFdPath()
      if (!fdPath) throw new Error(FD_NOT_FOUND_MESSAGE)

      if (!(await pathExists(searchPath))) {
        throw new Error(`Path not found: ${searchPath}`)
      }

      const args: string[] = ['--glob', '--color=never', '--hidden', '--no-require-git', '--max-results', String(effectiveLimit)]

      let effectivePattern = pattern
      if (pattern.includes('/')) {
        args.push('--full-path')
        if (!pattern.startsWith('/') && !pattern.startsWith('**/') && pattern !== '**') {
          effectivePattern = `**/${pattern}`
        }
      }
      args.push('--', effectivePattern, searchPath)

      return new Promise((resolve, reject) => {
        let settled = false
        let stopChild: (() => void) | undefined
        const settle = (fn: () => void) => {
          if (settled) return
          settled = true
          signal?.removeEventListener('abort', onAbort)
          stopChild = undefined
          fn()
        }
        const onAbort = () => {
          stopChild?.()
          settle(() => reject(new Error('Operation aborted')))
        }
        signal?.addEventListener('abort', onAbort, { once: true })

        const child = spawn(fdPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })
        const rl = createInterface({ input: child.stdout })
        let stderr = ''
        const lines: string[] = []

        stopChild = () => {
          if (!child.killed) child.kill()
        }

        child.stderr?.on('data', chunk => {
          stderr += chunk.toString()
        })

        rl.on('line', line => {
          lines.push(line)
        })

        child.on('error', error => {
          rl.close()
          settle(() => reject(new Error(`Failed to run fd: ${error.message}`)))
        })

        child.on('close', code => {
          rl.close()
          if (signal?.aborted) {
            settle(() => reject(new Error('Operation aborted')))
            return
          }

          const output = lines.join('\n')
          if (code !== 0) {
            const errorMsg = stderr.trim() || `fd exited with code ${code}`
            if (!output) {
              settle(() => reject(new Error(errorMsg)))
              return
            }
          }
          if (!output) {
            settle(() => resolve({ content: [{ type: 'text', text: 'No files found matching pattern' }], details: undefined }))
            return
          }

          const relativized: string[] = []
          for (const rawLine of lines) {
            const line = rawLine.replace(/\r$/, '').trim()
            if (!line) continue
            const hadTrailingSlash = line.endsWith('/') || line.endsWith('\\')
            let relativePath = line
            if (line.startsWith(searchPath)) {
              relativePath = line.slice(searchPath.length + 1)
            } else {
              relativePath = nodePath.relative(searchPath, line)
            }
            if (hadTrailingSlash && !relativePath.endsWith('/')) relativePath += '/'
            relativized.push(toPosixPath(relativePath))
          }

          settle(() => resolve(formatFindOutput(relativized, effectiveLimit)))
        })
      })
    },
  }
}

function formatFindOutput(
  relativized: string[],
  effectiveLimit: number,
): {
  content: Array<{ type: 'text'; text: string }>
  details: FindToolDetails | undefined
} {
  const resultLimitReached = relativized.length >= effectiveLimit
  const rawOutput = relativized.join('\n')
  const truncation = truncateHead(rawOutput, { maxLines: Number.MAX_SAFE_INTEGER })
  let resultOutput = truncation.content
  const details: FindToolDetails = {}
  const notices: string[] = []

  if (resultLimitReached) {
    notices.push(`${effectiveLimit} results limit reached. Use limit=${effectiveLimit * 2} for more, or refine pattern`)
    details.resultLimitReached = effectiveLimit
  }
  if (truncation.truncated) {
    notices.push(`${formatSize(DEFAULT_MAX_BYTES)} limit reached`)
    details.truncation = truncation
  }
  if (notices.length > 0) resultOutput += `\n\n[${notices.join('. ')}]`

  return {
    content: [{ type: 'text' as const, text: resultOutput }],
    details: Object.keys(details).length > 0 ? details : undefined,
  }
}
