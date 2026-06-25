import { Braces, GitBranch, type LucideIcon } from 'lucide-react'
import { matchPath } from 'react-router-dom'

export type RightPanelTabType = 'session-tree' | 'llm-inspect'

export type RightPanelRouteKey = 'chat'

export interface RightPanelTabDefinition {
  type: RightPanelTabType
  labelKey: 'rightPanel.tabs.sessionTree' | 'rightPanel.tabs.llmInspect'
  icon: LucideIcon
}

export const RIGHT_PANEL_TAB_DEFINITIONS: Record<RightPanelTabType, RightPanelTabDefinition> = {
  'session-tree': {
    type: 'session-tree',
    labelKey: 'rightPanel.tabs.sessionTree',
    icon: GitBranch,
  },
  'llm-inspect': {
    type: 'llm-inspect',
    labelKey: 'rightPanel.tabs.llmInspect',
    icon: Braces,
  },
}

export function getRightPanelRouteKey(pathname: string): RightPanelRouteKey | null {
  if (matchPath('/chat/:sessionId', pathname)) {
    return 'chat'
  }
  return null
}

export function getAvailableTabTypesForPath(pathname: string): RightPanelTabType[] {
  if (matchPath('/chat/:sessionId', pathname)) {
    return ['session-tree', 'llm-inspect']
  }
  return []
}

export function getDefaultTabTypeForPath(pathname: string): RightPanelTabType | null {
  if (matchPath('/chat/:sessionId', pathname)) {
    return 'session-tree'
  }
  return null
}
