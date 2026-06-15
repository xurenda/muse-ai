import type { CliConfig } from '../config.js'
import { BackendClient, buildCliEndpoint } from '../backend/client.js'
import { resolveBackendUrl } from '../backend/llm-auth.js'
import { getMusePaths, loadMuseConfig } from '../paths.js'

const HEARTBEAT_INTERVAL_MS = 30_000

export function startDeviceHeartbeat(config: CliConfig): () => void {
  const tick = async () => {
    try {
      const museConfig = await loadMuseConfig(getMusePaths())
      if (!museConfig.deviceToken) return

      const client = BackendClient.fromConfig(museConfig.backendUrl)
      const endpoint = buildCliEndpoint(config.host, config.port)
      await client.heartbeat(museConfig.deviceToken, endpoint)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[muse] 设备心跳失败: ${message}`)
    }
  }

  void tick()
  const timer = setInterval(() => void tick(), HEARTBEAT_INTERVAL_MS)

  return () => {
    if (timer) clearInterval(timer)
  }
}

export async function resolveBackendAuthFromConfig(): Promise<{ backendUrl: string; deviceToken: string } | undefined> {
  const museConfig = await loadMuseConfig(getMusePaths())
  if (!museConfig.deviceToken) return undefined
  return {
    backendUrl: resolveBackendUrl(museConfig.backendUrl),
    deviceToken: museConfig.deviceToken,
  }
}
