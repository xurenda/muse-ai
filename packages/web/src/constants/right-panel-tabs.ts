import { GitBranch, ScanSearch, type LucideIcon } from 'lucide-react'
import { matchPath } from 'react-router-dom'

export type RightPanelTabType = 'session-tree' | 'llm-inspect'

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
    icon: ScanSearch,
  },
}

export function getAvailableTabTypesForPath(pathname: string): RightPanelTabType[] {
  if (matchPath('/chat/:sessionId', pathname)) {
    return ['session-tree', 'llm-inspect']
  }
  return []
}

export function getDefaultTabTypesForPath(pathname: string): RightPanelTabType[] {
  if (matchPath('/chat/:sessionId', pathname)) {
    return ['session-tree']
  }
  return []
}
