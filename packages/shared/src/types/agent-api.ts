import { z } from 'zod'
import { modelRefSchema, thinkingLevelSchema } from './agent.js'
import { sessionTokenUsageSchema } from './session-token-usage.js'

export const createAgentRequestSchema = z.object({
  name: z.string().min(1).max(64),
  personaId: z.string().min(1),
  skillIds: z.array(z.string().min(1)).default([]),
  activeToolNames: z.array(z.string().min(1)).default([]),
  description: z.string().max(256).optional(),
})

export type CreateAgentRequest = z.infer<typeof createAgentRequestSchema>

export const toolDescriptorSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
})

export type ToolDescriptor = z.infer<typeof toolDescriptorSchema>

export const sessionSettingsPatchSchema = z
  .object({
    agentId: z.string().uuid().optional(),
    modelRef: modelRefSchema.optional(),
    thinkingLevel: thinkingLevelSchema.optional(),
  })
  .refine(data => data.agentId !== undefined || data.modelRef !== undefined || data.thinkingLevel !== undefined, {
    message: '至少提供一个设置字段',
  })

export type SessionSettingsPatch = z.infer<typeof sessionSettingsPatchSchema>

export const sessionSettingsResponseSchema = z.object({
  sessionId: z.string().uuid(),
  agentId: z.string().uuid(),
  modelRef: modelRefSchema,
  thinkingLevel: thinkingLevelSchema,
  tokenUsage: sessionTokenUsageSchema,
})

export type SessionSettingsResponse = z.infer<typeof sessionSettingsResponseSchema>
