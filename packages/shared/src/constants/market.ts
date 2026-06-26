/** 官方基础套件市场包 id */
export const BASIC_KIT_PACKAGE_ID = 'museai/basic-kit'

/** 本机自建资产命名空间（username 保留名） */
export const LOCAL_ASSET_NAMESPACE = 'local'

/** v0.2 单包体积上限（与 market.md 一致） */
export const MUSEPACK_MAX_BYTES = 10 * 1024 * 1024

/**
 * 禁止注册的 username（含官方账号与系统保留名）。
 * server 与 Web 共用；接口对保留名返回与「已占用」相同的 `username_taken`。
 */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  LOCAL_ASSET_NAMESPACE,
  'muse',
  'museai',
  'muse-ai',
  'admin',
  'api',
  'www',
  'root',
  'system',
  'support',
  'help',
  'market',
  'auth',
])

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.has(username.toLowerCase())
}
