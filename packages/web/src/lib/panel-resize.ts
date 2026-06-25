import type { PanelImperativeHandle, PanelSize } from 'react-resizable-panels'

interface PersistPanelLayoutOptions {
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
  if (inPixels > 0) {
    options.setWidth(inPixels)
  }
}

/** 拖拽收拢时同步 open 状态；忽略挂载时的初始 onResize */
export function syncPanelOpenFromResize(panelSize: PanelSize, prevPanelSize: PanelSize | undefined, setOpen: (open: boolean) => void): void {
  if (prevPanelSize === undefined) {
    return
  }

  if (panelSize.inPixels <= 0) {
    setOpen(false)
  }
}
