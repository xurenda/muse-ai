import type { ReactFlowInstance } from '@xyflow/react'

const MIN_ZOOM = 0.4
const MAX_ZOOM = 1.5
const FIT_DURATION = 150
const FIT_PADDING = { top: 16, right: 16, bottom: 16, left: 16 } as const

interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** 计算水平居中、垂直居上的 viewport（区别于默认 fitView 的垂直居中） */
export function getTopAlignedViewport(
  bounds: Bounds,
  width: number,
  height: number,
  options?: { minZoom?: number; maxZoom?: number },
): { x: number; y: number; zoom: number } {
  const minZoom = options?.minZoom ?? MIN_ZOOM
  const maxZoom = options?.maxZoom ?? MAX_ZOOM
  const availableWidth = width - FIT_PADDING.left - FIT_PADDING.right
  const availableHeight = height - FIT_PADDING.top - FIT_PADDING.bottom

  if (bounds.width <= 0 || bounds.height <= 0 || availableWidth <= 0 || availableHeight <= 0) {
    return { x: 0, y: 0, zoom: 1 }
  }

  const zoom = clamp(Math.min(availableWidth / bounds.width, availableHeight / bounds.height), minZoom, maxZoom)
  const x = width / 2 - (bounds.x + bounds.width / 2) * zoom
  const y = FIT_PADDING.top - bounds.y * zoom

  return { x, y, zoom }
}

type FitViewFlow = Pick<ReactFlowInstance, 'getNodes' | 'getNodesBounds' | 'setViewport'>

/** Session 树专用 fit：顶部对齐，水平居中 */
export async function fitSessionTreeViewTop(flow: FitViewFlow, container: HTMLElement): Promise<void> {
  const nodes = flow.getNodes()
  if (nodes.length === 0) return

  const bounds = flow.getNodesBounds(nodes)
  const { width, height } = container.getBoundingClientRect()
  if (width <= 0 || height <= 0) return

  const viewport = getTopAlignedViewport(bounds, width, height)
  await flow.setViewport(viewport, { duration: FIT_DURATION })
}

export { FIT_DURATION }
