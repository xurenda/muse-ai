import { isProcessAlive } from '../utils/is-process-alive'
import { pingDaemon, readDaemonState, removeDaemonState } from '../daemon/state'

const STOP_TIMEOUT_MS = 5_000

function waitForProcessExit(pid: number): Promise<boolean> {
  return new Promise((resolve) => {
    const startedAt = Date.now()

    const timer = setInterval(() => {
      if (!isProcessAlive(pid)) {
        clearInterval(timer)
        resolve(true)
        return
      }

      if (Date.now() - startedAt >= STOP_TIMEOUT_MS) {
        clearInterval(timer)
        resolve(false)
      }
    }, 100)
  })
}

export async function runDaemonStop(): Promise<void> {
  const state = await readDaemonState()
  if (!state) {
    console.log('Daemon 未运行')
    return
  }

  if (!isProcessAlive(state.pid)) {
    await removeDaemonState()
    console.log('Daemon 未运行（已清理过期状态）')
    return
  }

  const healthy = await pingDaemon(state.host, state.port)
  if (!healthy) {
    await removeDaemonState()
    console.log('Daemon 未运行（已清理过期状态）')
    return
  }

  process.kill(state.pid, 'SIGTERM')
  const stopped = await waitForProcessExit(state.pid)

  if (!stopped) {
    process.kill(state.pid, 'SIGKILL')
    await waitForProcessExit(state.pid)
  }

  await removeDaemonState()
  console.log(`Daemon 已停止 (pid=${state.pid})`)
}
