import { readFile, unlink, writeFile } from 'node:fs/promises'
import { DEFAULT_DAEMON_HOST } from '@muse-ai/shared'
import type { DaemonHealthResponse, DaemonState } from '@muse-ai/shared'
import { getDaemonStatePath } from '../config/paths'
import { isProcessAlive } from '../utils/is-process-alive'

export async function readDaemonState(): Promise<DaemonState | null> {
  try {
    const raw = await readFile(getDaemonStatePath(), 'utf8')
    return JSON.parse(raw) as DaemonState
  } catch {
    return null
  }
}

export async function writeDaemonState(state: DaemonState): Promise<void> {
  await writeFile(getDaemonStatePath(), `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

export async function removeDaemonState(): Promise<void> {
  try {
    await unlink(getDaemonStatePath())
  } catch {
    // 状态文件不存在时忽略
  }
}

export async function pingDaemon(host: string, port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://${host}:${port}/health`, {
      signal: AbortSignal.timeout(2_000),
    })
    if (!response.ok) {
      return false
    }

    const body = (await response.json()) as DaemonHealthResponse
    return body.status === 'ok'
  } catch {
    return false
  }
}

export async function findRunningDaemon(): Promise<DaemonState | null> {
  const state = await readDaemonState()
  if (!state) {
    return null
  }

  if (!isProcessAlive(state.pid)) {
    return null
  }

  const healthy = await pingDaemon(state.host, state.port)
  return healthy ? state : null
}

export async function assertDaemonNotRunning(): Promise<void> {
  const running = await findRunningDaemon()
  if (!running) {
    return
  }

  console.error(
    `Daemon 已在运行 (pid=${running.pid}, http://${running.host}:${running.port})`,
  )
  process.exit(1)
}

export function createDaemonState(port: number, version: string): DaemonState {
  return {
    host: DEFAULT_DAEMON_HOST,
    port,
    pid: process.pid,
    startedAt: new Date().toISOString(),
    version,
  }
}
