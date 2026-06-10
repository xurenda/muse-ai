import { findRunningDaemon, readDaemonState, removeDaemonState } from '../daemon/state'

export async function runDaemonStatus(): Promise<void> {
  const running = await findRunningDaemon()
  if (running) {
    console.log(`Daemon 在线: http://${running.host}:${running.port} (pid=${running.pid})`)
    return
  }

  const stale = await readDaemonState()
  if (stale) {
    await removeDaemonState()
    console.log('Daemon 未运行（已清理过期状态）')
    return
  }

  console.log('Daemon 未运行')
}
