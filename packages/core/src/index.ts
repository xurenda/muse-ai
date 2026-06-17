export const CORE_VERSION = '0.0.0'

export {
  MuseAgentRegistry,
  composeSystemPrompt,
  type AgentRuntimeContext,
  type CreateAgentInput,
  type LoadedPersona,
  type MuseAssetRoots,
} from './agent-registry.js'
export { buildHarnessOptionsForSession } from './harness-factory.js'
export { MuseHarness } from './muse-harness.js'
export { placeholderGetApiKeyAndHeaders } from './get-api-key.js'
export { DEFAULT_MODEL_REF, formatModelRef, parseModelRef } from './model-ref.js'
export { readSessionRuntimeOverrides, resolveEffectiveHarnessConfig, type SessionRuntimeOverrides } from './session-runtime.js'
export { deriveSessionTitle } from './session-title.js'
export { MuseSessionStore, SessionStoreError, type CreateSessionParams, type MuseSessionStoreOptions } from './session-store.js'
export {
  buildBranchFromSession,
  filterEntriesToBranchPath,
  findConversationTipEntryId,
  mapBranchMessages,
  mapSessionTreeEntry,
  resolveBranchLeafId,
  resolveNavigateLeafId,
  resolveNavigateTargetLeafId,
  findTurnUserEntryId,
  findTurnTipEntryId,
  getMessagePathToLeaf,
} from './session-tree.js'
export {
  loadSessionRegistry,
  saveSessionRegistry,
  toSessionMeta,
  SESSION_REGISTRY_VERSION,
  type SessionRegistryEntry,
  type SessionRegistryFile,
} from './session-registry.js'
export type { MuseHarnessOptions } from './types.js'
export { mapHarnessEventToSse } from './harness-events.js'
export { extractAssistantTurnError, extractBranchMessageError, formatLlmErrorMessage } from './assistant-turn-error.js'
export type { AgentTool, AgentToolResult } from '@earendil-works/pi-agent-core'
