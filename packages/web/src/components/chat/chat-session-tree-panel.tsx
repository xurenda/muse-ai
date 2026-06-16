import { SessionTreePanel } from '@/components/chat/session-tree-panel'
import { useChatSessionContext } from '@/context/chat-session-context'

export function ChatSessionTreePanel() {
  const { sessionTree, status, streaming, navigateToEntry, forkFromEntry } = useChatSessionContext()

  return (
    <SessionTreePanel
      tree={sessionTree}
      disabled={status !== 'ready' || streaming}
      onNavigate={entryId => void navigateToEntry(entryId)}
      onFork={entryId => void forkFromEntry(entryId)}
    />
  )
}
