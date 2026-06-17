import { z } from 'zod'
import { compactionReasonSchema } from './session-compact.js'
import { sessionNameSourceSchema } from './session.js'
import { turnTokenUsageSchema } from './session-token-usage.js'

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
  }),
  z.object({ type: z.literal('agent_end') }),
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
