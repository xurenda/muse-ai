/** 左侧边栏 Panel id */
export const SIDEBAR_PANEL_ID = 'sidebar'

/** 主内容 Panel id */
export const MAIN_PANEL_ID = 'main'

/** 主内容区 Panel id（右侧边栏左侧） */
export const MAIN_CONTENT_PANEL_ID = 'main-content'

/** 右侧边栏 Panel id */
export const RIGHT_PANEL_ID = 'right-panel'

/** 左侧边栏默认宽度（px） */
export const SIDEBAR_DEFAULT_WIDTH = 200

/** 左侧边栏最小宽度（px） */
export const SIDEBAR_MIN_WIDTH = 150

/** 左侧边栏最大宽度（px） */
export const SIDEBAR_MAX_WIDTH = 420

/** 主内容区最小宽度（px） */
export const MAIN_MIN_WIDTH = 360

/** 右侧边栏默认宽度（px） */
export const RIGHT_PANEL_DEFAULT_WIDTH = 300

/** 右侧边栏最小宽度（px） */
export const RIGHT_PANEL_MIN_WIDTH = 250

/** 右侧边栏最大宽度（px） */
export const RIGHT_PANEL_MAX_WIDTH = 520

/** 将左侧边栏宽度限制在合法范围内 */
export function clampSidebarWidth(width: number): number {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)))
}

/** 将右侧边栏宽度限制在合法范围内 */
export function clampRightPanelWidth(width: number): number {
  return Math.min(RIGHT_PANEL_MAX_WIDTH, Math.max(RIGHT_PANEL_MIN_WIDTH, Math.round(width)))
}
