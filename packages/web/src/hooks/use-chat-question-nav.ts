import { useCallback, useEffect, useState, type RefObject } from 'react'
import { findActiveQuestionIndex, type UserQuestionItem } from '@/lib/chat-question-nav'

interface UseChatQuestionNavOptions {
  scrollContainerRef: RefObject<HTMLElement | null>
  userQuestions: UserQuestionItem[]
  onScrollToMessage: (messageId: string) => void
  resetKey?: string | null
}

interface UseChatQuestionNavResult {
  currentIndex: number
  canGoPrev: boolean
  canGoNext: boolean
  goToPrev: () => void
  goToNext: () => void
  goToQuestion: (messageId: string) => void
}

export function useChatQuestionNav({ scrollContainerRef, userQuestions, onScrollToMessage, resetKey }: UseChatQuestionNavOptions): UseChatQuestionNavResult {
  const [currentIndex, setCurrentIndex] = useState(0)

  const updateCurrentIndex = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container || userQuestions.length === 0) {
      setCurrentIndex(0)
      return
    }
    setCurrentIndex(findActiveQuestionIndex(container, userQuestions))
  }, [scrollContainerRef, userQuestions])

  useEffect(() => {
    updateCurrentIndex()
  }, [userQuestions, updateCurrentIndex, resetKey])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    container.addEventListener('scroll', updateCurrentIndex, { passive: true })
    return () => container.removeEventListener('scroll', updateCurrentIndex)
  }, [scrollContainerRef, updateCurrentIndex, resetKey])

  const goToQuestion = useCallback(
    (messageId: string) => {
      onScrollToMessage(messageId)
      const index = userQuestions.findIndex(question => question.id === messageId)
      if (index >= 0) {
        setCurrentIndex(index)
      }
    },
    [onScrollToMessage, userQuestions],
  )

  const goToPrev = useCallback(() => {
    const prev = userQuestions[currentIndex - 1]
    if (!prev) return
    goToQuestion(prev.id)
  }, [currentIndex, goToQuestion, userQuestions])

  const goToNext = useCallback(() => {
    const next = userQuestions[currentIndex + 1]
    if (!next) return
    goToQuestion(next.id)
  }, [currentIndex, goToQuestion, userQuestions])

  return {
    currentIndex,
    canGoPrev: currentIndex > 0,
    canGoNext: currentIndex < userQuestions.length - 1,
    goToPrev,
    goToNext,
    goToQuestion,
  }
}
