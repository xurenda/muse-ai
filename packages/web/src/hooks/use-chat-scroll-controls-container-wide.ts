import { useLayoutEffect, useState, type RefObject } from 'react'

/** 容器宽度 ≥ 此值时视为宽屏（48rem 内容列 + 工具条与留白） */
export const CHAT_SCROLL_CONTROLS_OUTSIDE_MIN_WIDTH_PX = 880

/** 与 CSS `@min-[55rem]/chat-scroll-controls` 同步，供大纲菜单弹出方向判断 */
export function useChatScrollControlsContainerWide(containerRef: RefObject<HTMLElement | null>, rerenderKey?: string | null): boolean {
  const [wide, setWide] = useState(false)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const update = () => {
      setWide(container.clientWidth >= CHAT_SCROLL_CONTROLS_OUTSIDE_MIN_WIDTH_PX)
    }

    update()

    const observer = new ResizeObserver(update)
    observer.observe(container)

    return () => observer.disconnect()
  }, [containerRef, rerenderKey])

  return wide
}
