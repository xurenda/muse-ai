/** basic-kit 默认 Agent 目录 slug（`agents/general/`） */
export const DEFAULT_BASIC_KIT_AGENT_SLUG = 'general'

/**
 * 未配置 `activeAgentId` 时的默认 Agent id。
 * 与 CLI `resolveAgentId(BASIC_KIT_PACKAGE_ID, 'general')` 一致（避免 browser bundle 引入 node:crypto）。
 */
export const DEFAULT_AGENT_ID = '50d49f69-1ce7-4220-bc6a-be4391a1859f'
