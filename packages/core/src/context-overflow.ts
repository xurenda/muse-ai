import type { AssistantMessage } from '@earendil-works/pi-ai'
import { isContextOverflow } from '@earendil-works/pi-ai'

/** 判断 assistant 响应是否表示 context 溢出（供 CLI 自动 compact 使用） */
export function isAssistantContextOverflow(message: AssistantMessage, contextWindow?: number): boolean {
  return isContextOverflow(message, contextWindow)
}
