/** 右侧边栏可打开的面板 id */
export type RightSidebarPanelId = 'trace'

export interface RightSidebarAction {
  id: RightSidebarPanelId
  labelKey: string
}

/** 根据当前路由解析右侧边栏「+」菜单项 */
export function resolveRightSidebarActions(pathname: string): RightSidebarAction[] {
  if (/^\/chat\/[^/]+$/.test(pathname)) {
    return [{ id: 'trace', labelKey: 'rightSidebar.actions.trace' }]
  }

  return []
}
