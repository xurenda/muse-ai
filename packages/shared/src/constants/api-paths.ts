/** Server REST 路径常量 */
export const SERVER_API_PATHS = {
  HEALTH: '/health',
  AUTH_LOGIN: '/auth/login',
  AUTH_REGISTER: '/auth/register',
  DEVICES: '/devices',
  DEVICES_PAIR: '/devices/pair',
  DEVICES_HEARTBEAT: '/devices/heartbeat',
  PROVIDERS: '/providers',
  LLM_PROXY: '/v1/chat/completions',
} as const

/** CLI daemon REST 路径常量 */
export const CLI_API_PATHS = {
  HEALTH: '/health',
  AGENTS: '/agents',
  SESSIONS: '/sessions',
  CHAT: '/chat',
  /** 路由模式；实际路径用 `sessionEventsPath(sessionId)` */
  SESSION_EVENTS: '/sessions/:sessionId/events',
} as const

/** 构建 Session SSE 路径：`GET /sessions/:id/events` */
export function sessionEventsPath(sessionId: string): string {
  return `/sessions/${sessionId}/events`
}

export type ServerApiPath = (typeof SERVER_API_PATHS)[keyof typeof SERVER_API_PATHS]
export type CliApiPath = (typeof CLI_API_PATHS)[keyof typeof CLI_API_PATHS]

/** 默认服务端口 */
export const DEFAULT_PORTS = {
  SERVER: 3000,
  CLI: 7421,
  WEB_DEV: 5173,
} as const
