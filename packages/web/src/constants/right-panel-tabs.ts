import { GitBranch, type LucideIcon } from 'lucide-react'
import { matchPath } from 'react-router-dom'

export type RightPanelTabType = 'session-tree'

export interface RightPanelTabDefinition {
  type: RightPanelTabType
  labelKey: 'rightPanel.tabs.sessionTree'
  icon: LucideIcon
}

export const RIGHT_PANEL_TAB_DEFINITIONS: Record<RightPanelTabType, RightPanelTabDefinition> = {
  'session-tree': {
    type: 'session-tree',
    labelKey: 'rightPanel.tabs.sessionTree',
    icon: GitBranch,
  },
}

export function getAvailableTabTypesForPath(pathname: string): RightPanelTabType[] {
  if (matchPath('/chat/:sessionId', pathname)) {
    return ['session-tree']
  }
  return []
}

export function getDefaultTabTypesForPath(pathname: string): RightPanelTabType[] {
  if (matchPath('/chat/:sessionId', pathname)) {
    return ['session-tree']
  }
  return []
}
