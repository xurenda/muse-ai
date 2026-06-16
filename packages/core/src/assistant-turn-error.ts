import type { AssistantMessage } from '@earendil-works/pi-ai'

/** 将 LLM / 代理原始错误文案转为用户可读提示 */
export function formatLlmErrorMessage(raw: string): string {
  const text = raw.trim()
  if (!text) return 'LLM 请求失败'
  if (text.includes('no_provider') || text.includes('未配置 LLM Provider')) {
    return '未配置 LLM Provider：请先在 Web 设置页配置供应方凭证，并在「模型」页设为默认'
  }
  return text
}

function formatAssistantFailure(stopReason: 'error' | 'aborted', errorMessage?: string): string {
  if (stopReason === 'aborted') {
    return formatLlmErrorMessage(errorMessage ?? '请求已中断')
  }
  return formatLlmErrorMessage(errorMessage ?? 'LLM 请求失败')
}

/** pi prompt 返回 stopReason 为 error/aborted 时提取 SSE error 文案 */
export function extractAssistantTurnError(message: AssistantMessage): string | null {
  if (message.stopReason !== 'error' && message.stopReason !== 'aborted') {
    return null
  }
  return formatAssistantFailure(message.stopReason, message.errorMessage)
}

/** 从 session 分支中的 assistant 消息提取持久化错误 */
export function extractBranchMessageError(message: { role: string; stopReason?: string; errorMessage?: string }): string | null {
  if (message.role !== 'assistant') return null
  if (message.stopReason !== 'error' && message.stopReason !== 'aborted') return null
  return formatAssistantFailure(message.stopReason, message.errorMessage)
}
