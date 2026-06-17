import { useCallback, useEffect, type RefObject } from 'react'
import { useReactFlow } from '@xyflow/react'
import { fitSessionTreeViewTop } from '@/lib/session-tree-fit-view'
import { useRightPanelStore } from '@/stores/right-panel'

const RESIZE_DEBOUNCE_MS = 150

function scheduleFitViewTop(flow: ReturnType<typeof useReactFlow>, container: HTMLElement): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      void fitSessionTreeViewTop(flow, container)
    })
  })
}

interface SessionTreeFlowAutoFitProps {
  containerRef: RefObject<HTMLElement | null>
  nodeCount: number
}

/** 在右栏展开、全屏切换、拖动改宽、窗口 resize 时自动 top-fit */
export function SessionTreeFlowAutoFit({ containerRef, nodeCount }: SessionTreeFlowAutoFitProps) {
  const flow = useReactFlow()
  const rightPanelOpen = useRightPanelStore(state => state.open)
  const rightPanelFullscreen = useRightPanelStore(state => state.fullscreen)

  const runFit = useCallback(() => {
    const container = containerRef.current
    if (!container || nodeCount === 0) return
    void fitSessionTreeViewTop(flow, container)
  }, [containerRef, flow, nodeCount])

  useEffect(() => {
    if (!rightPanelOpen || nodeCount === 0) return
    const container = containerRef.current
    if (!container) return
    scheduleFitViewTop(flow, container)
  }, [rightPanelOpen, rightPanelFullscreen, nodeCount, flow, containerRef])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let debounceTimer: ReturnType<typeof setTimeout> | undefined

    const observer = new ResizeObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(runFit, RESIZE_DEBOUNCE_MS)
    })

    observer.observe(container)

    return () => {
      observer.disconnect()
      if (debounceTimer) clearTimeout(debounceTimer)
    }
  }, [containerRef, runFit])

  return null
}

/** 供 Controls 手动 fit 按钮复用 */
export function useSessionTreeFitViewTop(containerRef: RefObject<HTMLElement | null>) {
  const flow = useReactFlow()

  return useCallback(() => {
    const container = containerRef.current
    if (!container) return
    void fitSessionTreeViewTop(flow, container)
  }, [containerRef, flow])
}
