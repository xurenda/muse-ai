import type { CliConfig } from '../config.js'
import { BackendClient, buildCliEndpoint } from '../backend/client.js'
import { resolveBackendUrl } from '../backend/llm-auth.js'
import { getMusePaths, loadMuseConfig } from '../paths.js'

/** Server 设备目录心跳间隔（仅 `/devices` registry，不驱动 Web 底栏） */
export const REGISTRY_HEARTBEAT_INTERVAL_MS = 30_000

/** 向 Server 上报设备目录状态（online + endpoint） */
export async function sendDeviceRegistryHeartbeat(config: CliConfig, online: boolean): Promise<void> {
  const museConfig = await loadMuseConfig(getMusePaths())
  if (!museConfig.deviceToken) return

  const client = BackendClient.fromConfig(museConfig.backendUrl)
  const endpoint = buildCliEndpoint(config.host, config.port)
  await client.heartbeat(museConfig.deviceToken, { endpoint, online })
}

/** 启动目录心跳：立即 online；退出 stop 时上报 offline */
export function startDeviceRegistryHeartbeat(config: CliConfig): () => Promise<void> {
  const tickOnline = () => {
    void sendDeviceRegistryHeartbeat(config, true).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[muse] 设备目录心跳失败: ${message}`)
    })
  }

  void tickOnline()
  const timer = setInterval(tickOnline, REGISTRY_HEARTBEAT_INTERVAL_MS)

  return async () => {
    clearInterval(timer)
    try {
      await sendDeviceRegistryHeartbeat(config, false)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[muse] 设备 offline 上报失败: ${message}`)
    }
  }
}

/** @deprecated 使用 startDeviceRegistryHeartbeat */
export const startDeviceHeartbeat = startDeviceRegistryHeartbeat

export async function resolveBackendAuthFromConfig(): Promise<{ backendUrl: string; deviceToken: string } | undefined> {
  const museConfig = await loadMuseConfig(getMusePaths())
  if (!museConfig.deviceToken) return undefined
  return {
    backendUrl: resolveBackendUrl(museConfig.backendUrl),
    deviceToken: museConfig.deviceToken,
  }
}
