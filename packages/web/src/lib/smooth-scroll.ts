/** 聊天区按钮触发的平滑滚动时长（原生 smooth 不可配置，偏慢） */
export const CHAT_SMOOTH_SCROLL_DURATION_MS = 500

function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function clampScrollTop(container: HTMLElement, targetTop: number): number {
  const maxTop = Math.max(0, container.scrollHeight - container.clientHeight)
  return Math.max(0, Math.min(targetTop, maxTop))
}

export function resolveScrollTopForElement(container: HTMLElement, element: HTMLElement): number {
  const containerRect = container.getBoundingClientRect()
  const elementRect = element.getBoundingClientRect()
  const scrollMarginTop = Number.parseFloat(getComputedStyle(element).scrollMarginTop) || 0
  return clampScrollTop(container, container.scrollTop + (elementRect.top - containerRect.top) - scrollMarginTop)
}

export function smoothScrollTop(container: HTMLElement, targetTop: number, durationMs = CHAT_SMOOTH_SCROLL_DURATION_MS): Promise<void> {
  const clampedTop = clampScrollTop(container, targetTop)

  if (prefersReducedMotion() || durationMs <= 0) {
    container.scrollTop = clampedTop
    return Promise.resolve()
  }

  const startTop = container.scrollTop
  const distance = clampedTop - startTop
  if (Math.abs(distance) < 1) {
    return Promise.resolve()
  }

  return new Promise(resolve => {
    const startTime = performance.now()

    const step = (now: number) => {
      const progress = Math.min((now - startTime) / durationMs, 1)
      container.scrollTop = startTop + distance * easeOutCubic(progress)
      if (progress < 1) {
        requestAnimationFrame(step)
      } else {
        resolve()
      }
    }

    requestAnimationFrame(step)
  })
}

export function smoothScrollIntoView(container: HTMLElement, element: HTMLElement, durationMs = CHAT_SMOOTH_SCROLL_DURATION_MS): Promise<void> {
  return smoothScrollTop(container, resolveScrollTopForElement(container, element), durationMs)
}
