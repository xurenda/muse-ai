import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { ChatSessionTreePanel } from '@/components/chat/chat-session-tree-panel'
import { ChatSessionLlmInspectPanel } from '@/components/chat/chat-session-llm-inspect-panel'
import { getAvailableTabTypesForPath } from '@/constants/right-panel-tabs'
import { useRightPanelStore } from '@/stores/right-panel'

export function RightPanelContent() {
  const { t } = useTranslation('layout')
  const { pathname } = useLocation()
  const availableTypes = getAvailableTabTypesForPath(pathname)
  const tabs = useRightPanelStore(state => state.tabs)
  const activeTabId = useRightPanelStore(state => state.activeTabId)
  const activeTab = tabs.find(tab => tab.id === activeTabId) ?? null

  if (!activeTab || !availableTypes.includes(activeTab.type)) {
    return <div className="flex flex-1 items-center justify-center px-4 text-center text-xs text-muted-foreground">{t('rightPanel.empty')}</div>
  }

  switch (activeTab.type) {
    case 'session-tree':
      return <ChatSessionTreePanel />
    case 'llm-inspect':
      return <ChatSessionLlmInspectPanel />
    default: {
      const _exhaustive: never = activeTab.type
      return _exhaustive
    }
  }
}
