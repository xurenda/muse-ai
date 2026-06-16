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
  PROVIDERS: '/providers',
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

/** 构建 Session 详情路径：`PATCH|DELETE /sessions/:id` */
export function sessionDetailPath(sessionId: string): string {
  return `/sessions/${sessionId}`
}

export type ServerApiPath = (typeof SERVER_API_PATHS)[keyof typeof SERVER_API_PATHS]
export type CliApiPath = (typeof CLI_API_PATHS)[keyof typeof CLI_API_PATHS]

/** 默认服务端口 */
export const DEFAULT_PORTS = {
  SERVER: 3000,
  CLI: 7421,
  WEB_DEV: 5173,
} as const
