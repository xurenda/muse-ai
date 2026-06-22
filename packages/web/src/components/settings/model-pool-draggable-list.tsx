import { DragDropContext, Draggable, Droppable, type DraggableProvidedDraggableProps, type DraggableStateSnapshot, type DropResult } from '@hello-pangea/dnd'
import { GripVertical, Trash2 } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { IconButton } from '@/components/ui/icon-button'
import { cn } from '@/lib/utils'
import { reorderPoolItems, removePoolItem, resolveModelLabel, type ModelCatalogItem } from '@/utils/model-strategy-ui'

interface ModelPoolDraggableListProps {
  droppableId: string
  pool: string[]
  catalog: ModelCatalogItem[]
  onChange: (nextPool: string[]) => void
}

/** 与官方 vertical list 示例一致：自定义样式在前，库内联 style 在后以保留 transform / transition */
function getDraggableStyle(draggableProps: DraggableProvidedDraggableProps, snapshot: DraggableStateSnapshot): CSSProperties {
  return {
    userSelect: 'none',
    ...(draggableProps.style as CSSProperties | undefined),
    ...(snapshot.isDragging
      ? {
          boxShadow: 'var(--shadow-popover)',
        }
      : null),
  }
}

export function ModelPoolDraggableList({ droppableId, pool, catalog, onChange }: ModelPoolDraggableListProps) {
  const { t } = useTranslation('settings')

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return
    const fromIndex = result.source.index
    const toIndex = result.destination.index
    if (fromIndex === toIndex) return
    onChange(reorderPoolItems(pool, fromIndex, toIndex))
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId={droppableId}>
        {(provided, snapshot) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className={cn('flex flex-col', snapshot.isDraggingOver && 'rounded-lg')}>
            {pool.map((modelRef, index) => (
              <Draggable key={modelRef} draggableId={`${droppableId}:${modelRef}`} index={index}>
                {(draggableProvided, draggableSnapshot) => (
                  <div
                    ref={draggableProvided.innerRef}
                    {...draggableProvided.draggableProps}
                    style={getDraggableStyle(draggableProvided.draggableProps, draggableSnapshot)}
                    className={cn(
                      'mb-2 flex items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-2',
                      draggableSnapshot.isDragging && 'border-border shadow-popover',
                    )}
                  >
                    <button
                      type="button"
                      {...draggableProvided.dragHandleProps}
                      aria-label={t('models.strategy.dragHandle')}
                      className="inline-flex size-7 shrink-0 cursor-grab items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing"
                    >
                      <GripVertical className="size-4" strokeWidth={2} />
                    </button>
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{resolveModelLabel(modelRef, catalog)}</span>
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{modelRef}</span>
                    <IconButton type="button" aria-label={t('models.strategy.removeModel')} onClick={() => onChange(removePoolItem(pool, index))}>
                      <Trash2 className="size-3.5" strokeWidth={2} />
                    </IconButton>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  )
}
