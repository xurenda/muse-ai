/** 将毫秒时长格式化为秒数（至少 1 秒），供 i18n 插值 */
export function formatDurationSeconds(ms: number): number | null {
  if (ms < 500) {
    return null
  }
  return Math.max(1, Math.round(ms / 1000))
}

export function getDurationMs(startedAt: number, endedAt?: number, fallbackNow = Date.now()): number {
  const end = endedAt ?? fallbackNow
  return Math.max(0, end - startedAt)
}
