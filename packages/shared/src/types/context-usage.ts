import { z } from 'zod'

/** 当前分支上下文窗口占用（非 Session 累计） */
export const contextUsageSchema = z.object({
  /** 估算占用 token；压缩后尚无新 assistant 响应时为 null */
  tokens: z.number().nonnegative().nullable(),
  /** 模型上下文窗口上限；未知时为 null */
  contextWindow: z.number().positive().nullable(),
  /** tokens / contextWindow * 100；任一侧为 null 时为 null */
  percent: z.number().nonnegative().nullable(),
  /** 末轮 assistant usage 反映的已计费上下文 */
  usageTokens: z.number().nonnegative().nullable().optional(),
  /** 末轮 usage 之后、尚未进入 billing 的估算 token */
  trailingTokens: z.number().nonnegative().nullable().optional(),
  /** 最近一轮 prompt 缓存命中率（0–100）；无 cache 时为 null */
  lastTurnCacheHitRate: z.number().min(0).max(100).nullable().optional(),
})

export type ContextUsage = z.infer<typeof contextUsageSchema>

export const EMPTY_CONTEXT_USAGE: ContextUsage = {
  tokens: null,
  contextWindow: null,
  percent: null,
  usageTokens: null,
  trailingTokens: null,
  lastTurnCacheHitRate: null,
}

/** 由 tokens 与 contextWindow 计算 percent；任一侧未知则 null */
export function computeContextUsagePercent(tokens: number | null, contextWindow: number | null): number | null {
  if (tokens === null || contextWindow === null || contextWindow <= 0) return null
  return (tokens / contextWindow) * 100
}
