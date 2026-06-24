import type { ChatMessage, UserChatMessage } from '@/lib/chat-types'

export const CHAT_MESSAGE_ANCHOR_PREFIX = 'chat-message-'

export interface UserQuestionItem {
  id: string
  /** 1-based 轮次序号 */
  index: number
  preview: string
}

export function getChatMessageAnchorId(messageId: string): string {
  return `${CHAT_MESSAGE_ANCHOR_PREFIX}${messageId}`
}

export function truncateQuestionPreview(content: string, maxLength = 40): string {
  const singleLine = content.replace(/\s+/g, ' ').trim()
  if (singleLine.length <= maxLength) return singleLine
  return `${singleLine.slice(0, maxLength)}…`
}

export function extractUserQuestions(messages: ChatMessage[]): UserQuestionItem[] {
  return messages
    .filter((message): message is UserChatMessage => message.role === 'user')
    .map((message, index) => ({
      id: message.id,
      index: index + 1,
      preview: truncateQuestionPreview(message.content),
    }))
}

/** 根据滚动位置判断当前可见的用户问题索引（0-based） */
export function findActiveQuestionIndex(container: HTMLElement, questions: UserQuestionItem[], anchorOffsetPx = 80): number {
  if (questions.length === 0) return 0

  const containerRect = container.getBoundingClientRect()
  const anchorY = containerRect.top + anchorOffsetPx

  let activeIndex = 0
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i]
    if (!question) continue
    const element = container.querySelector(`#${CSS.escape(getChatMessageAnchorId(question.id))}`)
    if (!(element instanceof HTMLElement)) continue
    if (element.getBoundingClientRect().top <= anchorY) {
      activeIndex = i
    }
  }

  return activeIndex
}
