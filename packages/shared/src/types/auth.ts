import { z } from 'zod'
import { usernameSchema } from '../schemas/market-id.js'

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export type LoginRequest = z.infer<typeof loginRequestSchema>

export const loginResponseSchema = z.object({
  accessToken: z.string().min(1),
  /** access token 过期的 Unix 时间戳（秒） */
  accessTokenExpiresAt: z.number().int().positive(),
  refreshToken: z.string().min(1),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    username: z.string().min(1).optional(),
  }),
})

export type LoginResponse = z.infer<typeof loginResponseSchema>

export const registerRequestSchema = loginRequestSchema.extend({
  username: usernameSchema,
})

export type RegisterRequest = z.infer<typeof registerRequestSchema>

export const refreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1),
})

export type RefreshTokenRequest = z.infer<typeof refreshTokenRequestSchema>

/** 刷新后返回新的 access token（refresh token 也一并轮换） */
export const refreshTokenResponseSchema = loginResponseSchema
export type RefreshTokenResponse = LoginResponse
