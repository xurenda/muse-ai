import { useCallback, useEffect, useRef } from 'react'

const SCROLL_THRESHOLD = 64

function isNearBottom(element: HTMLElement, threshold = SCROLL_THRESHOLD): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold
}

export function useStickToBottom<T extends HTMLElement>() {
  const containerRef = useRef<T>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true)

  const handleScroll = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    stickRef.current = isNearBottom(container)
  }, [])

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    endRef.current?.scrollIntoView({ behavior })
  }, [])

  const enableStick = useCallback(() => {
    stickRef.current = true
    scrollToBottom('smooth')
  }, [scrollToBottom])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  const onContentChange = useCallback(() => {
    if (stickRef.current) {
      scrollToBottom('smooth')
    }
  }, [scrollToBottom])

  return { containerRef, endRef, enableStick, onContentChange }
}
