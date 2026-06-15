import { z } from 'zod'

/** OpenAI 兼容 Provider 创建请求 */
export const providerCreateSchema = z.object({
  name: z.string().min(1).max(64),
  apiKey: z.string().min(1),
  /** 默认 https://api.openai.com/v1 */
  baseUrl: z.string().url().optional(),
  isDefault: z.boolean().optional(),
})

export type ProviderCreate = z.infer<typeof providerCreateSchema>

export const providerUpdateSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  apiKey: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
  isDefault: z.boolean().optional(),
})

export type ProviderUpdate = z.infer<typeof providerUpdateSchema>

/** 列表/详情响应（不含 apiKey） */
export const providerSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  baseUrl: z.string().url(),
  isDefault: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type ProviderSummary = z.infer<typeof providerSummarySchema>
