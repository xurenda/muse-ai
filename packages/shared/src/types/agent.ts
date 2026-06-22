import { z } from 'zod'

export const thinkingLevelSchema = z.enum(['off', 'minimal', 'low', 'medium', 'high', 'xhigh'])

export type ThinkingLevel = z.infer<typeof thinkingLevelSchema>

const MODEL_REF_PROVIDER_PATTERN = /^[a-z0-9_-]+$/i

/** 校验 provider/modelId；modelId 允许空格等字符以兼容 Ollama 等本地供应方 */
function isValidModelRef(ref: string): boolean {
  const slash = ref.indexOf('/')
  if (slash <= 0 || slash >= ref.length - 1) return false
  const provider = ref.slice(0, slash)
  const modelId = ref.slice(slash + 1)
  return MODEL_REF_PROVIDER_PATTERN.test(provider) && modelId.length > 0
}

/** provider/modelId，例如 anthropic/claude-sonnet-4-20250514、ollama/opus 4.8 */
export const modelRefSchema = z.string().min(3).refine(isValidModelRef, '应为 provider/modelId 格式')

export type ModelRef = z.infer<typeof modelRefSchema>

export const personaSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  /** 相对 persona 目录的路径，默认 system.md */
  systemPromptPath: z.string().min(1).default('system.md'),
  /** 阶段 3 接通 LLM 时使用；阶段 2 仅持久化 */
  defaultModel: modelRefSchema.optional(),
  thinkingLevel: thinkingLevelSchema.optional(),
})

export type Persona = z.infer<typeof personaSchema>

export const agentDefinitionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  personaId: z.string().min(1),
  skillIds: z.array(z.string().min(1)),
  description: z.string().optional(),
  /** 阶段 4 启用 tools 时使用；本阶段可为空 */
  activeToolNames: z.array(z.string().min(1)).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type AgentDefinition = z.infer<typeof agentDefinitionSchema>

export const skillMetaSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
})

export type SkillMeta = z.infer<typeof skillMetaSchema>
