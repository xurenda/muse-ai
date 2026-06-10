import { resolveDaemonPort } from '../config/paths'
import { ensureMuseDataLayout } from '../data/init-layout'
import { getCliVersion } from '../config/version'
import {
  assertDaemonNotRunning,
  createDaemonState,
  removeDaemonState,
  writeDaemonState,
} from '../daemon/state'
import { sessionManager } from '../core/session-manager'
import { startDaemonServer, stopDaemonServer } from '../daemon/server'

export async function runDaemonStart(portOverride?: number): Promise<void> {
  await assertDaemonNotRunning()
  await ensureMuseDataLayout()
  await sessionManager.initialize()

  const port = portOverride ?? resolveDaemonPort()
  const state = createDaemonState(port, getCliVersion())
  const { server } = await startDaemonServer(state)

  await writeDaemonState(state)

  console.log(`Muse daemon 已启动: http://${state.host}:${state.port} (pid=${state.pid})`)

  let shuttingDown = false

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) {
      return
    }
    shuttingDown = true

    console.log(`\n收到 ${signal}，正在停止 daemon...`)
    await stopDaemonServer(server)
    await removeDaemonState()
    process.exit(0)
  }

  process.on('SIGINT', () => {
    void shutdown('SIGINT')
  })
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM')
  })

  await new Promise<void>(() => {
    // 保持进程运行，直到收到退出信号
  })
}
