import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionTreeNode, SessionTreeResponse } from '@muse-ai/shared'
import { IconButton } from '@/components/ui/icon-button'
import { buildSessionTreeItems, isNodeOnActivePath, nodeLabel, type SessionTreeItem } from '@/lib/session-tree-utils'
import { cn } from '@/lib/utils'
import { GitBranchPlus } from 'lucide-react'

interface SessionTreePanelProps {
  tree: SessionTreeResponse | null
  disabled: boolean
  onNavigate: (entryId: string | null) => void
  onFork: (entryId: string) => void
}

function TreeNodeRow({
  item,
  leafId,
  entries,
  disabled,
  onNavigate,
  onFork,
}: {
  item: SessionTreeItem
  leafId: string | null
  entries: SessionTreeNode[]
  disabled: boolean
  onNavigate: (entryId: string) => void
  onFork: (entryId: string) => void
}) {
  const { t } = useTranslation('chat')
  const { node } = item
  const active = isNodeOnActivePath(entries, leafId, node.id)
  const canNavigate = true
  const canFork = node.type === 'message' || node.type === 'branch_summary'

  return (
    <li>
      <div className={cn('group flex items-start gap-0.5 rounded-lg py-0.5', active && 'bg-accent/80')} style={{ paddingLeft: `${item.depth * 10 + 4}px` }}>
        <button
          type="button"
          disabled={disabled || !canNavigate}
          className={cn(
            'ui-menu-item min-w-0 flex-1 rounded-lg px-2 py-1.5 text-xs',
            canNavigate ? 'text-foreground hover:bg-accent/60' : 'cursor-default text-muted-foreground',
            active && 'bg-accent text-accent-foreground',
          )}
          onClick={() => onNavigate(node.id)}
        >
          <span className="mr-1.5 rounded bg-muted px-1 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">{node.type}</span>
          <span className="break-words">{nodeLabel(node)}</span>
        </button>
        {canFork ? (
          <IconButton
            type="button"
            className="mt-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            disabled={disabled}
            aria-label={t('fork')}
            onClick={() => onFork(node.id)}
          >
            <GitBranchPlus className="size-3.5" strokeWidth={2} />
          </IconButton>
        ) : null}
      </div>
      {item.children.length > 0 ? (
        <ul>
          {item.children.map(child => (
            <TreeNodeRow key={child.node.id} item={child} leafId={leafId} entries={entries} disabled={disabled} onNavigate={onNavigate} onFork={onFork} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export function SessionTreePanel({ tree, disabled, onNavigate, onFork }: SessionTreePanelProps) {
  const { t } = useTranslation('chat')
  const items = useMemo(() => (tree ? buildSessionTreeItems(tree.entries) : []), [tree])

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-background">
      <div className="px-3 pb-2 pt-1">
        <p className="text-[11px] text-muted-foreground">{t('sessionTreeHint')}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {!tree || items.length === 0 ? (
          <p className="px-2 py-4 text-xs text-muted-foreground">{t('sessionTreeEmpty')}</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {items.map(item => (
              <TreeNodeRow
                key={item.node.id}
                item={item}
                leafId={tree.leafId}
                entries={tree.entries}
                disabled={disabled}
                onNavigate={entryId => void onNavigate(entryId)}
                onFork={entryId => void onFork(entryId)}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
