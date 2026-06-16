/** 从首条用户消息推导侧栏展示标题 */
export function deriveSessionTitle(message: string, maxLen = 80): string {
  const normalized = message.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLen) {
    return normalized
  }
  return `${normalized.slice(0, maxLen - 1)}…`
}
