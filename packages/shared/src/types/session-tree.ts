import { z } from 'zod'

const sessionTreeNodeBaseSchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  timestamp: z.string(),
  type: z.string(),
})

export const sessionTreeMessageNodeSchema = sessionTreeNodeBaseSchema.extend({
  type: z.literal('message'),
  role: z.enum(['user', 'assistant', 'toolResult']),
  preview: z.string(),
})

export const sessionTreeBranchSummaryNodeSchema = sessionTreeNodeBaseSchema.extend({
  type: z.literal('branch_summary'),
  summary: z.string(),
  fromId: z.string(),
})

export const sessionTreeLabelNodeSchema = sessionTreeNodeBaseSchema.extend({
  type: z.literal('label'),
  targetId: z.string(),
  label: z.string().optional(),
})

export const sessionTreeModelChangeNodeSchema = sessionTreeNodeBaseSchema.extend({
  type: z.literal('model_change'),
  provider: z.string(),
  modelId: z.string(),
})

export const sessionTreeThinkingChangeNodeSchema = sessionTreeNodeBaseSchema.extend({
  type: z.literal('thinking_level_change'),
  thinkingLevel: z.string(),
})

export const sessionTreeGenericNodeSchema = sessionTreeNodeBaseSchema.extend({
  type: z.enum(['active_tools_change', 'compaction', 'custom', 'custom_message', 'session_info', 'leaf']),
  summary: z.string().optional(),
})

export const sessionTreeNodeSchema = z.discriminatedUnion('type', [
  sessionTreeMessageNodeSchema,
  sessionTreeBranchSummaryNodeSchema,
  sessionTreeLabelNodeSchema,
  sessionTreeModelChangeNodeSchema,
  sessionTreeThinkingChangeNodeSchema,
  sessionTreeGenericNodeSchema,
])

export type SessionTreeNode = z.infer<typeof sessionTreeNodeSchema>

export const sessionBranchMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  text: z.string(),
  timestamp: z.string().optional(),
})

export type SessionBranchMessage = z.infer<typeof sessionBranchMessageSchema>

export const sessionTreeResponseSchema = z.object({
  sessionId: z.string().uuid(),
  leafId: z.string().nullable(),
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
