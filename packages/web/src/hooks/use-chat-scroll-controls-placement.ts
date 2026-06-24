import { useEffect, useState, type RefObject } from 'react'

/** 工具条与内容列间距（ml-3） */
const TOOLBAR_MARGIN_PX = 12
/** 边框、阴影、子像素与纵向滚动条占位 */
const SAFETY_BUFFER_PX = 16

interface UseChatScrollControlsPlacementOptions {
  anchorRef: RefObject<HTMLElement | null>
  toolbarRef: RefObject<HTMLElement | null>
}

/** 右侧留白足够时，工具条放到内容列外侧；否则叠在内容区右缘 */
export function useChatScrollControlsPlacement({ anchorRef, toolbarRef }: UseChatScrollControlsPlacementOptions): boolean {
  const [placeOutside, setPlaceOutside] = useState(false)

  useEffect(() => {
    const anchor = anchorRef.current
    if (!anchor) return

    const update = () => {
      const parent = anchor.parentElement
      if (!parent) return

      const toolbar = toolbarRef.current
      const toolbarWidth = toolbar?.getBoundingClientRect().width ?? 28

      const parentRect = parent.getBoundingClientRect()
      const anchorRect = anchor.getBoundingClientRect()
      const rightGutter = parentRect.right - anchorRect.right
      const requiredGutter = toolbarWidth + TOOLBAR_MARGIN_PX + SAFETY_BUFFER_PX
      const projectedToolbarRight = anchorRect.right + TOOLBAR_MARGIN_PX + toolbarWidth

      const fitsInParent = projectedToolbarRight <= parentRect.right - 1
      const fitsInViewport = projectedToolbarRight <= document.documentElement.clientWidth - 1

      setPlaceOutside(rightGutter >= requiredGutter && fitsInParent && fitsInViewport)
    }

    update()

    const observer = new ResizeObserver(update)
    observer.observe(anchor)
    const parent = anchor.parentElement
    if (parent) observer.observe(parent)
    const toolbar = toolbarRef.current
    if (toolbar) observer.observe(toolbar)

    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [anchorRef, toolbarRef])

  return placeOutside
}
