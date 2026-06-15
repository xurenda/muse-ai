export { CLI_API_PATHS, DEFAULT_PORTS, SERVER_API_PATHS, sessionEventsPath, type CliApiPath, type ServerApiPath } from './constants/api-paths.js'
export { DEFAULT_AGENT_ID } from './constants/default-agent.js'
export {
  BUILTIN_CODING_AGENT_ID,
  BUILTIN_GENERAL_AGENT_ID,
  BUILTIN_PERSONA_CODING,
  BUILTIN_PERSONA_GENERAL,
  BUILTIN_SKILL_GIT,
  BUILTIN_SKILL_REVIEW,
} from './constants/builtin-agents.js'
export { loginRequestSchema, loginResponseSchema, registerRequestSchema, type LoginRequest, type LoginResponse, type RegisterRequest } from './types/auth.js'
export {
  agentDefinitionSchema,
  modelRefSchema,
  personaSchema,
  skillMetaSchema,
  thinkingLevelSchema,
  type AgentDefinition,
  type ModelRef,
  type Persona,
  type SkillMeta,
  type ThinkingLevel,
} from './types/agent.js'
export { createSessionRequestSchema, sessionMetaSchema, type CreateSessionRequest, type SessionMeta } from './types/session.js'
export {
  deviceHeartbeatRequestSchema,
  devicePairRequestSchema,
  devicePairResponseSchema,
  deviceSchema,
  type Device,
  type DeviceHeartbeatRequest,
  type DevicePairRequest,
  type DevicePairResponse,
} from './types/device.js'
export { pairInitResponseSchema, type PairInitResponse } from './types/pair.js'
export {
  providerCreateSchema,
  providerSummarySchema,
  providerUpdateSchema,
  type ProviderCreate,
  type ProviderSummary,
  type ProviderUpdate,
} from './types/provider.js'
export { createHealthResponse, healthResponseSchema, type HealthResponse } from './types/health.js'
export { chatRequestSchema, formatSseData, museSseEventSchema, type ChatRequest, type MuseSseEvent } from './types/sse-events.js'
