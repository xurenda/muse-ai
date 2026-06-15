import { z } from 'zod'

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.string(),
  version: z.string().optional(),
})

export type HealthResponse = z.infer<typeof healthResponseSchema>

export function createHealthResponse(service: string, version?: string): HealthResponse {
  return version ? { ok: true, service, version } : { ok: true, service }
}
