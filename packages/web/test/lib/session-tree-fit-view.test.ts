import { describe, expect, it } from 'vitest'
import { getTopAlignedViewport } from '@/lib/session-tree-fit-view'

describe('session-tree-fit-view', () => {
  it('getTopAlignedViewport 应垂直居上、水平居中', () => {
    const bounds = { x: 0, y: 100, width: 200, height: 300 }
    const viewport = getTopAlignedViewport(bounds, 400, 800)

    expect(viewport.zoom).toBeGreaterThan(0)
    // 顶部对齐：bounds.y * zoom + viewport.y ≈ padding top (16)
    expect(viewport.y + bounds.y * viewport.zoom).toBeCloseTo(16, 0)
    // 水平居中
    expect(viewport.x + (bounds.x + bounds.width / 2) * viewport.zoom).toBeCloseTo(200, 0)
  })

  it('内容较矮时不应垂直居中到视口中部', () => {
    const bounds = { x: 0, y: 0, width: 200, height: 200 }
    const centeredY = 400 / 2 - (bounds.y + bounds.height / 2) * 1
    const topAligned = getTopAlignedViewport(bounds, 400, 800, { minZoom: 1, maxZoom: 1 })

    expect(topAligned.y).toBe(16)
    expect(topAligned.y).not.toBeCloseTo(centeredY, 0)
  })
})
