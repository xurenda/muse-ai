import { ensureMuseDir, getMusePaths, type MusePaths } from './paths.js'
import { syncBasicKit } from './market/market-installer.js'

/** 确保目录结构存在并同步官方 basic-kit（首装 / CLI 升级） */
export async function ensureMuseRuntimeReady(paths: MusePaths = getMusePaths()): Promise<void> {
  await ensureMuseDir(paths)
  await syncBasicKit(paths)
}
