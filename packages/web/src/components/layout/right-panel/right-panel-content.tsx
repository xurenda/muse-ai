import { useTranslation } from 'react-i18next'
import { ChatSessionTreePanel } from '@/components/chat/chat-session-tree-panel'
import { useRightPanelStore } from '@/stores/right-panel'

export function RightPanelContent() {
  const { t } = useTranslation('layout')
  const tabs = useRightPanelStore(state => state.tabs)
  const activeTabId = useRightPanelStore(state => state.activeTabId)
  const activeTab = tabs.find(tab => tab.id === activeTabId) ?? null

  if (!activeTab) {
    return <div className="flex flex-1 items-center justify-center px-4 text-center text-xs text-muted-foreground">{t('rightPanel.empty')}</div>
  }

  switch (activeTab.type) {
    case 'session-tree':
      return <ChatSessionTreePanel />
    default: {
      const _exhaustive: never = activeTab.type
      return _exhaustive
    }
  }
}
