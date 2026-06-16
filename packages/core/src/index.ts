export const CORE_VERSION = '0.0.0'

export {
  MuseAgentRegistry,
  composeSystemPrompt,
  type AgentRuntimeContext,
  type CreateAgentInput,
  type LoadedPersona,
  type MuseAssetRoots,
} from './agent-registry.js'
export { MuseHarness } from './muse-harness.js'
export { placeholderGetApiKeyAndHeaders } from './get-api-key.js'
export { MuseSessionStore, type CreateSessionParams, type MuseSessionStoreOptions } from './session-store.js'
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
export type { AgentTool, AgentToolResult } from '@earendil-works/pi-agent-core'
