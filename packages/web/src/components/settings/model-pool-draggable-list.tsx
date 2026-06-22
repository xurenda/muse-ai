import { DragDropContext, Draggable, Droppable, type DraggableProvided, type DropResult } from '@hello-pangea/dnd'
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

/** 与官方 vertical list 示例一致：保留库内联 transform / transition，仅合并额外样式 */
function getDraggableStyle(provided: DraggableProvided, style?: CSSProperties | null): CSSProperties {
  if (!style) {
    return (provided.draggableProps.style ?? {}) as CSSProperties
  }

  return {
    ...(provided.draggableProps.style as CSSProperties),
    ...style,
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
        {provided => (
          <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col transition-colors">
            {pool.map((modelRef, index) => (
              <Draggable key={modelRef} draggableId={`${droppableId}:${modelRef}`} index={index}>
                {(draggableProvided, draggableSnapshot) => {
                  const isDragging = draggableSnapshot.isDragging && !draggableSnapshot.isDropAnimating

                  return (
                    <div
                      ref={draggableProvided.innerRef}
                      {...draggableProvided.draggableProps}
                      style={getDraggableStyle(draggableProvided)}
                      className={cn(
                        'group mb-0.5 flex select-none items-center gap-inline border border-border/70 bg-background px-menu-x py-menu-y',
                        isDragging && 'border-border shadow-popover',
                      )}
                    >
                      <IconButton
                        type="button"
                        {...draggableProvided.dragHandleProps}
                        aria-label={t('models.strategy.dragHandle')}
                        className="cursor-grab active:cursor-grabbing"
                      >
                        <GripVertical className="size-3.5" strokeWidth={2} />
                      </IconButton>
                      <div className="flex min-w-0 flex-1 items-center gap-inline">
                        <span className="truncate text-sm text-foreground">{resolveModelLabel(modelRef, catalog)}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{modelRef}</span>
                      </div>
                      <IconButton
                        type="button"
                        aria-label={t('models.strategy.removeModel')}
                        className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
                        onClick={() => onChange(removePoolItem(pool, index))}
                      >
                        <Trash2 className="size-3.5" strokeWidth={2} />
                      </IconButton>
                    </div>
                  )
                }}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  )
}
