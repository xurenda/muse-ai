import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionTreeNode, SessionTreeResponse } from '@muse-ai/shared'
import { Button } from '@/components/ui/button'
import { buildSessionTreeItems, isNodeOnActivePath, nodeLabel, type SessionTreeItem } from '@/lib/session-tree-utils'
import { cn } from '@/lib/utils'

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
  const canNavigate = node.type !== 'leaf'
  const canFork = node.type === 'message' || node.type === 'branch_summary'

  return (
    <li>
      <div className={cn('group flex items-start gap-1 rounded-md px-1 py-1', active && 'bg-primary/10')} style={{ paddingLeft: `${item.depth * 12 + 4}px` }}>
        <button
          type="button"
          disabled={disabled || !canNavigate}
          className={cn('min-w-0 flex-1 text-left text-xs', canNavigate ? 'hover:text-primary' : 'cursor-default text-muted-foreground')}
          onClick={() => onNavigate(node.id)}
        >
          <span className="mr-1 rounded bg-muted px-1 py-0.5 text-[10px] uppercase">{node.type}</span>
          <span className="break-words">{nodeLabel(node)}</span>
        </button>
        {canFork ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 shrink-0 px-1 text-[10px] opacity-0 group-hover:opacity-100"
            disabled={disabled}
            onClick={() => onFork(node.id)}
          >
            {t('fork')}
          </Button>
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
    <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-card/40">
      <div className="border-b border-border px-3 py-2">
        <h2 className="text-sm font-medium">{t('sessionTreeTitle')}</h2>
        <p className="text-[10px] text-muted-foreground">{t('sessionTreeHint')}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {!tree || items.length === 0 ? (
          <p className="px-2 py-4 text-xs text-muted-foreground">{t('sessionTreeEmpty')}</p>
        ) : (
          <ul>
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
