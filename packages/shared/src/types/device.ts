import { z } from 'zod'

export const deviceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  /** 浏览器直连 CLI 的 base URL，如 https://cli.example.com:65433 */
  endpoint: z.string().url().optional(),
  online: z.boolean(),
  lastSeenAt: z.string().datetime().optional(),
})

export type Device = z.infer<typeof deviceSchema>

export const devicePairRequestSchema = z.object({
  pairCode: z.string().min(6).max(12),
  name: z.string().min(1).max(64),
  endpoint: z.string().url().optional(),
})

export type DevicePairRequest = z.infer<typeof devicePairRequestSchema>

export const devicePairResponseSchema = z.object({
  device: deviceSchema,
  accessToken: z.string().min(1),
})

export type DevicePairResponse = z.infer<typeof devicePairResponseSchema>

export const deviceHeartbeatRequestSchema = z.object({
  endpoint: z.string().url().optional(),
  online: z.boolean().default(true),
})

export type DeviceHeartbeatRequest = z.infer<typeof deviceHeartbeatRequestSchema>

/** Web 直连 CLI 所需凭证（user JWT 鉴权后返回） */
export const deviceCredentialsResponseSchema = z.object({
  deviceId: z.string().uuid(),
  endpoint: z.string().url(),
  accessToken: z.string().min(1),
})

export type DeviceCredentialsResponse = z.infer<typeof deviceCredentialsResponseSchema>
