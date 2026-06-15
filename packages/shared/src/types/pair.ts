import { z } from 'zod'

/** Web 端发起配对：生成短时配对码 */
export const pairInitResponseSchema = z.object({
  pairCode: z.string().min(6).max(12),
  expiresAt: z.string().datetime(),
})

export type PairInitResponse = z.infer<typeof pairInitResponseSchema>
