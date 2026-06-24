import { formatTokenCount } from './format-token-count'

/** 格式化用时：< 60s → "42s"，>= 60s → "3m38s" */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m${seconds}s`
}

/** 格式化 turn 统计（底部状态栏 / 消息元信息） */
export function formatTurnStats(tokens: number, durationMs: number, approximate: boolean): string {
  const tokenStr = `${approximate ? '~\u202f' : ''}${formatTokenCount(tokens)} Tokens`
  const timeStr = formatDuration(durationMs)
  return `${tokenStr} · ${timeStr}`
}
