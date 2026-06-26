import { loadMuseConfig, type MusePaths } from '../paths.js'
import { resolveBackendUrl } from '../backend/llm-auth.js'
import { MarketInstallerError } from './market-errors.js'

/** 从本机 config 解析 Backend 安装所需 URL 与 device token */
export async function resolveMarketBackendOptions(paths: MusePaths): Promise<{
  backendUrl: string
  deviceToken: string
}> {
  let config
  try {
    config = await loadMuseConfig(paths)
  } catch {
    throw new MarketInstallerError('device_not_paired', '请先执行 muse pair 完成设备配对')
  }
  if (!config.deviceToken) {
    throw new MarketInstallerError('device_not_paired', '请先执行 muse pair 完成设备配对')
  }
  return {
    backendUrl: resolveBackendUrl(config.backendUrl),
    deviceToken: config.deviceToken,
  }
}
