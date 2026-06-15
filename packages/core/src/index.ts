export const CORE_VERSION = '0.0.0'

export { MuseHarness } from './muse-harness.js'
export { placeholderGetApiKeyAndHeaders } from './get-api-key.js'
export { MuseSessionStore, type MuseSessionStoreOptions } from './session-store.js'
export {
  loadSessionRegistry,
  saveSessionRegistry,
  toSessionMeta,
  SESSION_REGISTRY_VERSION,
  type SessionRegistryEntry,
  type SessionRegistryFile,
} from './session-registry.js'
export type { MuseHarnessOptions } from './types.js'
