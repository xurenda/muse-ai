import { z } from 'zod'

export const sessionMetaSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().uuid(),
  name: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type SessionMeta = z.infer<typeof sessionMetaSchema>

export const createSessionRequestSchema = z.object({
  /** 省略时使用 config.activeAgentId，再回退内置默认 Agent */
  agentId: z.string().uuid().optional(),
  name: z.string().optional(),
})

export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>
