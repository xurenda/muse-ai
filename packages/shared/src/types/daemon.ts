/** 写入 ~/.muse/daemon.json 的 daemon 运行状态 */
export interface DaemonState {
  host: string
  port: number
  pid: number
  startedAt: string
  version: string
}

/** GET /health 响应 */
export interface DaemonHealthResponse {
  status: 'ok'
}

/** GET /info 响应 */
export interface DaemonInfoResponse extends DaemonState {
  uptimeMs: number
}
