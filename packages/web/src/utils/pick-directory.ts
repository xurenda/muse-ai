/** Electron 等宿主注入的目录选择桥接 */
interface MuseHostBridge {
  pickDirectory?: () => Promise<string | null>
}

declare global {
  interface Window {
    muse?: MuseHostBridge
  }
}

/** 当前环境是否支持原生目录选择（Electron 等） */
export function isPickDirectorySupported(): boolean {
  return typeof window.muse?.pickDirectory === 'function'
}

/** 打开原生目录选择器；Web 纯浏览器环境返回 null，需改用手动输入 */
export async function pickDirectory(): Promise<string | null> {
  const bridge = window.muse?.pickDirectory
  if (!bridge) {
    return null
  }

  try {
    return await bridge()
  } catch {
    return null
  }
}
