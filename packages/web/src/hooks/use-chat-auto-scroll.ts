import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { getChatMessageAnchorId } from '@/lib/chat-question-nav'
import { CHAT_SMOOTH_SCROLL_DURATION_MS, smoothScrollIntoView, smoothScrollTop } from '@/lib/smooth-scroll'

/** 哨兵与容器底部之间的容差（px），用户在此范围内视为「在底部」 */
const BOTTOM_ROOT_MARGIN_PX = 80
/** 滚动条拖拽时，距底部超过此值则停止跟随 */
const SCROLL_END_THRESHOLD_PX = 80
/** 距顶部在此范围内视为「在顶部」 */
const SCROLL_TOP_THRESHOLD_PX = 80

interface UseChatAutoScrollOptions {
  /** 消息等内容变化时，若处于跟随模式则滚到底 */
  contentDeps: unknown[]
  /** 切换会话等场景：重置跟随并滚到底 */
  resetKey?: string | null
  /** streaming 结束时若在底部则补一次对齐 */
  streaming?: boolean
}

interface UseChatAutoScrollResult {
  scrollContainerRef: RefObject<HTMLDivElement | null>
  bottomSentinelRef: (node: HTMLDivElement | null) => void
  /** 挂到输入区/footer 外壳，与 scrollContainer 一并监听尺寸变化 */
  footerResizeTargetRef: (node: HTMLElement | null) => void
  /** 哨兵是否在视口内（含底部容差） */
  isAtBottom: boolean
  /** 滚动位置是否在顶部附近 */
  isAtTop: boolean
  /** 是否显示「回到底部」按钮 */
  showScrollToBottom: boolean
  /** 恢复跟随并平滑滚到底（按钮点击） */
  scrollToBottom: () => void
  /** 发送消息等场景：强制恢复跟随并立即滚到底 */
  resumeFollowing: () => void
  /** 跳转到指定消息锚点（会暂停自动跟随） */
  scrollToMessage: (messageId: string) => void
  /** 平滑滚到顶部（会暂停自动跟随） */
  scrollToTop: () => void
}

export function useChatAutoScroll({ contentDeps, resetKey, streaming = false }: UseChatAutoScrollOptions): UseChatAutoScrollResult {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const bottomSentinelNodeRef = useRef<HTMLDivElement | null>(null)
  const footerResizeNodeRef = useRef<HTMLElement | null>(null)
  const autoFollowRef = useRef(true)
  const isAtBottomRef = useRef(true)
  const prevStreamingRef = useRef(streaming)
  const programmaticScrollRef = useRef(false)
  const programmaticScrollUntilRef = useRef(0)

  const [isAtBottom, setIsAtBottom] = useState(true)
  const [isAtTop, setIsAtTop] = useState(true)
  const [refsVersion, setRefsVersion] = useState(0)
  const [footerRefsVersion, setFooterRefsVersion] = useState(0)

  const markProgrammaticScroll = useCallback((durationMs = 0) => {
    programmaticScrollRef.current = true
    programmaticScrollUntilRef.current = Date.now() + durationMs
    if (durationMs === 0) {
      requestAnimationFrame(() => {
        if (Date.now() >= programmaticScrollUntilRef.current) {
          programmaticScrollRef.current = false
        }
      })
    } else {
      window.setTimeout(() => {
        if (Date.now() >= programmaticScrollUntilRef.current) {
          programmaticScrollRef.current = false
        }
      }, durationMs)
    }
  }, [])

  const scrollToBottomInstant = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return
    markProgrammaticScroll(0)
    container.scrollTo({ top: container.scrollHeight, behavior: 'instant' })
  }, [markProgrammaticScroll])

  const scrollToBottomSmooth = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return
    autoFollowRef.current = true
    markProgrammaticScroll(CHAT_SMOOTH_SCROLL_DURATION_MS + 32)
    void smoothScrollTop(container, container.scrollHeight)
  }, [markProgrammaticScroll])

  const resumeFollowing = useCallback(() => {
    autoFollowRef.current = true
    scrollToBottomInstant()
  }, [scrollToBottomInstant])

  const disableFollowing = useCallback(() => {
    autoFollowRef.current = false
  }, [])

  const scrollToMessage = useCallback(
    (messageId: string) => {
      const container = scrollContainerRef.current
      if (!container) return
      const target = container.querySelector(`#${CSS.escape(getChatMessageAnchorId(messageId))}`)
      if (!(target instanceof HTMLElement)) return
      disableFollowing()
      markProgrammaticScroll(CHAT_SMOOTH_SCROLL_DURATION_MS + 32)
      void smoothScrollIntoView(container, target)
    },
    [disableFollowing, markProgrammaticScroll],
  )

  const scrollToTop = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return
    disableFollowing()
    markProgrammaticScroll(CHAT_SMOOTH_SCROLL_DURATION_MS + 32)
    void smoothScrollTop(container, 0)
  }, [disableFollowing, markProgrammaticScroll])

  const shouldAlignToBottom = useCallback(() => {
    return autoFollowRef.current || isAtBottomRef.current
  }, [])

  const alignToBottomIfNeeded = useCallback(() => {
    if (!shouldAlignToBottom()) return
    scrollToBottomInstant()
  }, [scrollToBottomInstant, shouldAlignToBottom])

  const alignToBottomAfterLayout = useCallback(() => {
    if (!shouldAlignToBottom()) return
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToBottomInstant()
      })
    })
  }, [scrollToBottomInstant, shouldAlignToBottom])

  const bottomSentinelRef = useCallback((node: HTMLDivElement | null) => {
    bottomSentinelNodeRef.current = node
    if (node) {
      setRefsVersion(v => v + 1)
    }
  }, [])

  const footerResizeTargetRef = useCallback((node: HTMLElement | null) => {
    footerResizeNodeRef.current = node
    if (node) {
      setFooterRefsVersion(v => v + 1)
    }
  }, [])

  // IntersectionObserver：判断是否在底部；滚回底部时自动恢复跟随
  useEffect(() => {
    const root = scrollContainerRef.current
    const sentinel = bottomSentinelNodeRef.current
    if (!root || !sentinel) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const atBottom = entry?.isIntersecting ?? false
        setIsAtBottom(atBottom)
        isAtBottomRef.current = atBottom
        if (atBottom) {
          autoFollowRef.current = true
        }
      },
      {
        root,
        rootMargin: `0px 0px ${BOTTOM_ROOT_MARGIN_PX}px 0px`,
        threshold: 0,
      },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [resetKey, refsVersion])

  // 同步是否在顶部（供单轮对话「回到顶部」按钮）
  useEffect(() => {
    const root = scrollContainerRef.current
    if (!root) return

    const syncAtTop = () => {
      setIsAtTop(root.scrollTop <= SCROLL_TOP_THRESHOLD_PX)
    }

    syncAtTop()
    root.addEventListener('scroll', syncAtTop, { passive: true })

    const observer = new ResizeObserver(syncAtTop)
    observer.observe(root)

    return () => {
      root.removeEventListener('scroll', syncAtTop)
      observer.disconnect()
    }
  }, [resetKey, refsVersion])

  // 用户主动滚动：停止跟随（滚轮、触摸、滚动条）
  useEffect(() => {
    const root = scrollContainerRef.current
    if (!root) return

    const onWheel = (event: WheelEvent) => {
      if (event.deltaY < 0) {
        disableFollowing()
      }
    }

    let touchStartY = 0
    const onTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0]?.clientY ?? 0
    }
    const onTouchMove = (event: TouchEvent) => {
      const currentY = event.touches[0]?.clientY ?? 0
      // 手指下移 → 内容上移
      if (currentY - touchStartY > 10) {
        disableFollowing()
      }
    }

    const onScroll = () => {
      if (programmaticScrollRef.current || Date.now() < programmaticScrollUntilRef.current) return
      const distanceFromBottom = root.scrollHeight - root.scrollTop - root.clientHeight
      if (distanceFromBottom > SCROLL_END_THRESHOLD_PX) {
        disableFollowing()
      }
    }

    root.addEventListener('wheel', onWheel, { passive: true })
    root.addEventListener('touchstart', onTouchStart, { passive: true })
    root.addEventListener('touchmove', onTouchMove, { passive: true })
    root.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      root.removeEventListener('wheel', onWheel)
      root.removeEventListener('touchstart', onTouchStart)
      root.removeEventListener('touchmove', onTouchMove)
      root.removeEventListener('scroll', onScroll)
    }
  }, [resetKey, refsVersion, disableFollowing])

  // 消息区或输入区高度变化：在底部时补滚（窗口缩放、textarea 撑高等）
  useEffect(() => {
    const targets: HTMLElement[] = []
    const container = scrollContainerRef.current
    const footer = footerResizeNodeRef.current
    if (container) targets.push(container)
    if (footer) targets.push(footer)
    if (targets.length === 0) return

    const observer = new ResizeObserver(() => {
      alignToBottomIfNeeded()
    })
    for (const target of targets) {
      observer.observe(target)
    }
    return () => observer.disconnect()
  }, [resetKey, refsVersion, footerRefsVersion, alignToBottomIfNeeded])

  // streaming 结束：process 折叠、planning 消失等布局变化后再对齐一次
  useEffect(() => {
    const wasStreaming = prevStreamingRef.current
    prevStreamingRef.current = streaming
    if (wasStreaming && !streaming) {
      alignToBottomAfterLayout()
    }
  }, [streaming, alignToBottomAfterLayout])

  // 内容变化：跟随模式下 instant 滚到底
  useEffect(() => {
    if (!autoFollowRef.current) return
    scrollToBottomInstant()
    // contentDeps 由调用方传入（如 messages、streaming）
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅响应内容变化
  }, contentDeps)

  // 切换会话：重置跟随
  useEffect(() => {
    autoFollowRef.current = true
    isAtBottomRef.current = true
    scrollToBottomInstant()
    const frameId = requestAnimationFrame(() => {
      setIsAtBottom(true)
      setIsAtTop(true)
    })
    return () => cancelAnimationFrame(frameId)
  }, [resetKey, scrollToBottomInstant])

  return {
    scrollContainerRef,
    bottomSentinelRef,
    footerResizeTargetRef,
    isAtBottom,
    isAtTop,
    showScrollToBottom: !isAtBottom,
    scrollToBottom: scrollToBottomSmooth,
    resumeFollowing,
    scrollToMessage,
    scrollToTop,
  }
}
