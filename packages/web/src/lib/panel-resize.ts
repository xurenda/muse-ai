import type { PanelImperativeHandle } from 'react-resizable-panels'

interface PersistPanelLayoutOptions {
  setOpen: (open: boolean) => void
  setWidth: (width: number) => void
  shouldSkip?: () => boolean
}

/** 在 Group onLayoutChanged 中持久化侧栏宽度（跳过挂载后的首次 layout） */
export function persistPanelLayout(skipInitialLayoutRef: { current: boolean }, panel: PanelImperativeHandle | null, options: PersistPanelLayoutOptions): void {
  if (skipInitialLayoutRef.current) {
    skipInitialLayoutRef.current = false
    return
  }

  if (options.shouldSkip?.()) {
    return
  }

  if (!panel) {
    return
  }

  const { inPixels } = panel.getSize()
  if (panel.isCollapsed() || inPixels <= 0) {
    options.setOpen(false)
    return
  }

  options.setOpen(true)
  options.setWidth(inPixels)
}
