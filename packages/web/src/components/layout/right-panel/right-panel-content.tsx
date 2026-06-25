import { lazy, Suspense, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { RightPanelTabType } from '@/constants/right-panel-tabs'
import { useRightPanelStore } from '@/stores/right-panel'
import { cn } from '@/lib/utils'

const ChatSessionTreePanel = lazy(() =>
  import('@/components/chat/chat-session-tree-panel').then(module => ({
    default: module.ChatSessionTreePanel,
  })),
)

const ChatSessionLlmInspectPanel = lazy(() =>
  import('@/components/chat/chat-session-llm-inspect-panel').then(module => ({
    default: module.ChatSessionLlmInspectPanel,
  })),
)

function RightPanelTabFallback() {
  const { t } = useTranslation('layout')

  return <div className="flex flex-1 items-center justify-center px-4 text-center text-xs text-muted-foreground">{t('rightPanel.loading')}</div>
}

interface RightPanelTabPaneProps {
  type: RightPanelTabType
  activeTab: RightPanelTabType | null
  mounted: boolean
  children: ReactNode
}

function RightPanelTabPane({ type, activeTab, mounted, children }: RightPanelTabPaneProps) {
  if (!mounted) {
    return null
  }

  return (
    <div role="tabpanel" hidden={activeTab !== type} className={cn('min-h-0 flex-1 flex-col', activeTab === type ? 'flex' : 'hidden')}>
      <Suspense fallback={<RightPanelTabFallback />}>{children}</Suspense>
    </div>
  )
}

function useMountedRightPanelTabs(activeTab: RightPanelTabType | null): Set<RightPanelTabType> {
  const [mountedTabs, setMountedTabs] = useState<Set<RightPanelTabType>>(() => new Set())

  if (activeTab !== null && !mountedTabs.has(activeTab)) {
    setMountedTabs(previous => {
      if (previous.has(activeTab)) {
        return previous
      }

      const next = new Set(previous)
      next.add(activeTab)
      return next
    })
  }

  return mountedTabs
}

export function RightPanelContent() {
  const activeTab = useRightPanelStore(state => state.activeTab)
  const mountedTabs = useMountedRightPanelTabs(activeTab)

  return (
    <>
      <RightPanelTabPane type="session-tree" activeTab={activeTab} mounted={mountedTabs.has('session-tree')}>
        <ChatSessionTreePanel />
      </RightPanelTabPane>

      <RightPanelTabPane type="llm-inspect" activeTab={activeTab} mounted={mountedTabs.has('llm-inspect')}>
        <ChatSessionLlmInspectPanel enabled={activeTab === 'llm-inspect'} />
      </RightPanelTabPane>
    </>
  )
}
