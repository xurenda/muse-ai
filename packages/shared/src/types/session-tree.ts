import { z } from 'zod'

const sessionTreeNodeBaseSchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  timestamp: z.string(),
  type: z.string(),
})

export const sessionTreeMessageNodeSchema = sessionTreeNodeBaseSchema.extend({
  type: z.literal('message'),
  role: z.enum(['user', 'assistant']),
  preview: z.string(),
})

export const sessionTreeBranchSummaryNodeSchema = sessionTreeNodeBaseSchema.extend({
  type: z.literal('branch_summary'),
  summary: z.string(),
  fromId: z.string(),
})

export const sessionTreeNodeSchema = z.discriminatedUnion('type', [sessionTreeMessageNodeSchema, sessionTreeBranchSummaryNodeSchema])

export type SessionTreeNode = z.infer<typeof sessionTreeNodeSchema>

export const sessionBranchToolCallSchema = z.object({
  toolCallId: z.string(),
  toolName: z.string(),
  args: z.unknown(),
  result: z.unknown().optional(),
  isError: z.boolean().optional(),
})

export type SessionBranchToolCall = z.infer<typeof sessionBranchToolCallSchema>

export const sessionBranchTextBlockSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
})

export const sessionBranchToolsBlockSchema = z.object({
  type: z.literal('tools'),
  tools: z.array(sessionBranchToolCallSchema),
})

export const sessionBranchThinkingBlockSchema = z.object({
  type: z.literal('thinking'),
  thinking: z.string(),
  durationMs: z.number().int().nonnegative().optional(),
})

export const sessionBranchBlockSchema = z.discriminatedUnion('type', [
  sessionBranchThinkingBlockSchema,
  sessionBranchTextBlockSchema,
  sessionBranchToolsBlockSchema,
])

export type SessionBranchBlock = z.infer<typeof sessionBranchBlockSchema>

export const sessionBranchMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  text: z.string(),
  /** 模型推理过程（assistant content 中的 thinking 块） */
  thinking: z.string().optional(),
  /** 按出现顺序交错的正文与工具块（用于 Web 还原 think → text → tool → text 展示） */
  blocks: z.array(sessionBranchBlockSchema).optional(),
  toolCalls: z.array(sessionBranchToolCallSchema).optional(),
  /** LLM / 工具层失败时的可读错误（持久化自 session 树） */
  error: z.string().optional(),
  timestamp: z.string().optional(),
})

export type SessionBranchMessage = z.infer<typeof sessionBranchMessageSchema>

export const sessionTreeResponseSchema = z.object({
  sessionId: z.string().uuid(),
  leafId: z.string().nullable(),
  /** 当前 branch leaf 路径上的 message 节点 id（含 tool loop 中间 assistant） */
  activeMessagePathIds: z.array(z.string()),
  entries: z.array(sessionTreeNodeSchema),
  branch: z.array(sessionBranchMessageSchema),
})

export type SessionTreeResponse = z.infer<typeof sessionTreeResponseSchema>

export const sessionNavigateRequestSchema = z.object({
  /** null 表示回到根节点 */
  entryId: z.string().nullable(),
})

export type SessionNavigateRequest = z.infer<typeof sessionNavigateRequestSchema>

export const sessionForkRequestSchema = z.object({
  /** 省略则复制完整 session */
  entryId: z.string().optional(),
  position: z.enum(['before', 'at']).optional(),
  name: z.string().optional(),
})

export type SessionForkRequest = z.infer<typeof sessionForkRequestSchema>
