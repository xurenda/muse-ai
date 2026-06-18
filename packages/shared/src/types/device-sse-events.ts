import { z } from 'zod'

/** 设备级 SSE（Web→CLI `/device/events`），与 Session 聊天 SSE 分离 */
export const deviceSseEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('connected'),
    endpoint: z.string().url(),
    service: z.literal('cli'),
    version: z.string().optional(),
  }),
  z.object({ type: z.literal('ping') }),
  z.object({ type: z.literal('shutting_down') }),
  z.object({
    type: z.literal('session_registry_changed'),
    reason: z.enum(['created', 'deleted', 'renamed']).optional(),
  }),
])

export type DeviceSseEvent = z.infer<typeof deviceSseEventSchema>

export function formatDeviceSseData(event: DeviceSseEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}
