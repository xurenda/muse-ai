import { z } from 'zod'
import { modelRefSchema } from './agent.js'
import { modelSelectionSchema } from './model-strategy.js'

export const sessionNameSourceSchema = z.enum(['first_message', 'auto_llm', 'manual'])

export type SessionNameSource = z.infer<typeof sessionNameSourceSchema>

export const sessionMetaSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().uuid(),
  name: z.string().optional(),
  nameSource: sessionNameSourceSchema.optional(),
  modelSelection: modelSelectionSchema.optional(),
  lastResolvedModelRef: modelRefSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type SessionMeta = z.infer<typeof sessionMetaSchema>

export const sessionPatchRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
})

export type SessionPatchRequest = z.infer<typeof sessionPatchRequestSchema>

export const createSessionRequestSchema = z.object({
  /** 省略时使用 config.activeAgentId，再回退内置默认 Agent */
  agentId: z.string().uuid().optional(),
  name: z.string().optional(),
})

export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>
