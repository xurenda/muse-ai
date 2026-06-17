import { z } from 'zod'

export const compactionReasonSchema = z.enum(['manual', 'overflow', 'threshold'])

export type CompactionReason = z.infer<typeof compactionReasonSchema>

/** POST /sessions/:id/compact 请求体 */
export const sessionCompactRequestSchema = z.object({
  customInstructions: z.string().optional(),
})

export type SessionCompactRequest = z.infer<typeof sessionCompactRequestSchema>
