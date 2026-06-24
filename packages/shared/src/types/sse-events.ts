import { z } from 'zod'
import { MUSE_LLM_TASKS } from '../constants/llm-proxy.js'
import { compactionReasonSchema } from './session-compact.js'
import { sessionNameSourceSchema } from './session.js'
import { contextUsageSchema } from './context-usage.js'
import { turnTokenUsageSchema } from './session-token-usage.js'
import { modelRefSchema } from './agent.js'

export const museLlmTaskSchema = z.enum(MUSE_LLM_TASKS)

export type MuseLlmTaskSchema = z.infer<typeof museLlmTaskSchema>

/** CLI → Web SSE 事件（对齐 pi AgentEvent 子集） */
export const museSseEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('agent_start') }),
  z.object({ type: z.literal('turn_start') }),
  z.object({ type: z.literal('text_delta'), delta: z.string() }),
  z.object({ type: z.literal('thinking_delta'), delta: z.string() }),
  z.object({
    type: z.literal('tool_start'),
    toolCallId: z.string(),
    toolName: z.string(),
    args: z.unknown(),
  }),
  z.object({
    type: z.literal('tool_end'),
    toolCallId: z.string(),
    toolName: z.string(),
    result: z.unknown(),
    isError: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('turn_end'),
    usage: turnTokenUsageSchema.optional(),
    contextUsage: contextUsageSchema.optional(),
  }),
  z.object({ type: z.literal('agent_end'), durationMs: z.number().nonnegative().optional() }),
  z.object({
    type: z.literal('compaction_start'),
    reason: compactionReasonSchema,
  }),
  z.object({
    type: z.literal('compaction_end'),
    reason: compactionReasonSchema,
    success: z.boolean(),
    tokensBefore: z.number().optional(),
    compactionCount: z.number().int().nonnegative().optional(),
    willRetry: z.boolean().optional(),
    /** 用户主动 abort，Web 应静默恢复 UI */
    cancelled: z.boolean().optional(),
    errorMessage: z.string().optional(),
  }),
  z.object({ type: z.literal('error'), message: z.string() }),
  z.object({
    type: z.literal('session_meta_updated'),
    sessionId: z.string().uuid(),
    name: z.string(),
    nameSource: sessionNameSourceSchema.optional(),
    updatedAt: z.string().datetime(),
  }),
  z.object({
    type: z.literal('model_resolved'),
    modelRef: modelRefSchema,
    task: museLlmTaskSchema,
    usedFallback: z.boolean().optional(),
    /** 按尝试顺序排列的 modelRef；fallback 时首项为失败模型 */
    attemptedModelRefs: z.array(modelRefSchema).optional(),
    contextWindow: z.number().positive().optional(),
  }),
])

export type MuseSseEvent = z.infer<typeof museSseEventSchema>

export const chatRequestSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1),
  mode: z.enum(['prompt', 'steer', 'follow_up']).default('prompt'),
})

export type ChatRequest = z.infer<typeof chatRequestSchema>

/** SSE 流中单行 JSON 的序列化格式 */
export function formatSseData(event: MuseSseEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}
