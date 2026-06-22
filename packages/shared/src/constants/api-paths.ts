/** Server REST 路径常量 */
export const SERVER_API_PATHS = {
  HEALTH: '/health',
  AUTH_LOGIN: '/auth/login',
  AUTH_REGISTER: '/auth/register',
  DEVICES: '/devices',
  DEVICES_PAIR_INIT: '/devices/pair/init',
  DEVICES_PAIR: '/devices/pair',
  DEVICES_HEARTBEAT: '/devices/heartbeat',
  /** 路由模式；实际路径用 `deviceCredentialsPath(deviceId)` */
  DEVICE_CREDENTIALS: '/devices/:deviceId/credentials',
  SETTINGS_PROVIDERS: '/settings/providers',
  SETTINGS_MODELS_CONFIG: '/settings/models-config',
  SETTINGS_MODEL_STRATEGY: '/settings/model-strategy',
  /** LLM 代理根路径；实际转发路径为 `/v1/*` */
  LLM_PROXY: '/v1/chat/completions',
} as const

/** CLI daemon REST 路径常量 */
export const CLI_API_PATHS = {
  HEALTH: '/health',
  AGENTS: '/agents',
  PERSONAS: '/personas',
  SKILLS: '/skills',
  TOOLS: '/tools',
  SESSIONS: '/sessions',
  CHAT: '/chat',
  /** 路由模式；实际路径用 `sessionEventsPath(sessionId)` */
  SESSION_EVENTS: '/sessions/:sessionId/events',
  /** 路由模式；实际路径用 `sessionSettingsPath(sessionId)` */
  SESSION_SETTINGS: '/sessions/:sessionId/settings',
  /** 路由模式；实际路径用 `sessionTreePath(sessionId)` */
  SESSION_TREE: '/sessions/:sessionId/tree',
  /** 路由模式；实际路径用 `sessionNavigatePath(sessionId)` */
  SESSION_NAVIGATE: '/sessions/:sessionId/navigate',
  /** 路由模式；实际路径用 `sessionForkPath(sessionId)` */
  SESSION_FORK: '/sessions/:sessionId/fork',
  /** 路由模式；实际路径用 `sessionCompactPath(sessionId)` */
  SESSION_COMPACT: '/sessions/:sessionId/compact',
  /** 路由模式；实际路径用 `sessionAbortPath(sessionId)` */
  SESSION_ABORT: '/sessions/:sessionId/abort',
  /** 设备级 SSE：`GET /device/events` */
  DEVICE_EVENTS: '/device/events',
} as const

/** 构建 Session SSE 路径：`GET /sessions/:id/events` */
export function sessionEventsPath(sessionId: string): string {
  return `/sessions/${sessionId}/events`
}

/** 构建设备凭证路径：`GET /devices/:id/credentials` */
export function deviceCredentialsPath(deviceId: string): string {
  return `/devices/${deviceId}/credentials`
}

/** 构建 Session 设置路径：`GET|PATCH /sessions/:id/settings` */
export function sessionSettingsPath(sessionId: string): string {
  return `/sessions/${sessionId}/settings`
}

/** 构建 Session 树路径：`GET /sessions/:id/tree` */
export function sessionTreePath(sessionId: string): string {
  return `/sessions/${sessionId}/tree`
}

/** 构建 Session 导航路径：`POST /sessions/:id/navigate` */
export function sessionNavigatePath(sessionId: string): string {
  return `/sessions/${sessionId}/navigate`
}

/** 构建 Session fork 路径：`POST /sessions/:id/fork` */
export function sessionForkPath(sessionId: string): string {
  return `/sessions/${sessionId}/fork`
}

/** 构建 Session compact 路径：`POST /sessions/:id/compact` */
export function sessionCompactPath(sessionId: string): string {
  return `/sessions/${sessionId}/compact`
}

/** 构建 Session abort 路径：`POST /sessions/:id/abort` */
export function sessionAbortPath(sessionId: string): string {
  return `/sessions/${sessionId}/abort`
}

/** 构建设备级 SSE 路径：`GET /device/events` */
export function deviceEventsPath(): string {
  return CLI_API_PATHS.DEVICE_EVENTS
}

/** 构建 Session 详情路径：`PATCH|DELETE /sessions/:id` */
export function sessionDetailPath(sessionId: string): string {
  return `/sessions/${sessionId}`
}

export type ServerApiPath = (typeof SERVER_API_PATHS)[keyof typeof SERVER_API_PATHS]
export type CliApiPath = (typeof CLI_API_PATHS)[keyof typeof CLI_API_PATHS]

/** 默认服务端口 */
export const DEFAULT_PORTS = {
  SERVER: 65435,
  CLI: 65433,
  WEB_DEV: 65434,
} as const
