import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { thinkingLevelSchema, type ThinkingLevel } from '@muse-ai/shared'
import { cn } from '@/lib/utils'

const THINKING_LEVELS = thinkingLevelSchema.options

interface ReasoningLevelSliderProps {
  value: ThinkingLevel
  disabled?: boolean
  onChange: (level: ThinkingLevel) => void
}

function levelToIndex(level: ThinkingLevel): number {
  const index = THINKING_LEVELS.indexOf(level)
  return index >= 0 ? index : 0
}

function indexToLevel(index: number): ThinkingLevel {
  return THINKING_LEVELS[Math.max(0, Math.min(THINKING_LEVELS.length - 1, index))] ?? 'off'
}

function ratioToIndex(ratio: number, stepCount: number): number {
  if (stepCount <= 1) return 0
  return Math.round(Math.max(0, Math.min(1, ratio)) * (stepCount - 1))
}

function indexToRatio(index: number, stepCount: number): number {
  if (stepCount <= 1) return 0
  return index / (stepCount - 1)
}

export function ReasoningLevelSlider({ value, disabled, onChange }: ReasoningLevelSliderProps) {
  const { t } = useTranslation('chat')
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragRatio, setDragRatio] = useState<number | null>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const committedIndex = levelToIndex(value)
  const stepCount = THINKING_LEVELS.length
  const isDragging = dragRatio !== null
  const visualRatio = dragRatio ?? indexToRatio(committedIndex, stepCount)
  const previewIndex = isDragging ? ratioToIndex(visualRatio, stepCount) : hoverIndex
  const visualPercent = visualRatio * 100

  const clientXToRatio = useCallback((clientX: number) => {
    const track = trackRef.current
    if (!track) return 0
    const rect = track.getBoundingClientRect()
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }, [])

  const commitRatio = useCallback(
    (ratio: number) => {
      if (disabled) return
      const nextLevel = indexToLevel(ratioToIndex(ratio, stepCount))
      if (nextLevel !== value) onChange(nextLevel)
    },
    [disabled, onChange, stepCount, value],
  )

  const startDrag = useCallback(
    (clientX: number) => {
      if (disabled) return
      setHoverIndex(null)
      setDragRatio(clientXToRatio(clientX))
    },
    [clientXToRatio, disabled],
  )

  const finishDrag = useCallback(
    (ratio: number) => {
      commitRatio(ratio)
      setDragRatio(null)
    },
    [commitRatio],
  )

  useEffect(() => {
    if (!isDragging) return

    function handlePointerMove(event: PointerEvent) {
      setDragRatio(clientXToRatio(event.clientX))
    }

    function handlePointerUp(event: PointerEvent) {
      finishDrag(clientXToRatio(event.clientX))
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
    return () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
    }
  }, [clientXToRatio, finishDrag, isDragging])

  function handleTrackClick(event: React.MouseEvent<HTMLDivElement>) {
    if (disabled || isDragging) return
    commitRatio(clientXToRatio(event.clientX))
  }

  function showStepLabel(index: number): boolean {
    return isDragging ? previewIndex === index : hoverIndex === index
  }

  return (
    <div className={cn('select-none px-menu-x', disabled && 'opacity-50')}>
      <div className="mb-stack-sm flex justify-between px-0.5 text-[10px] text-muted-foreground">
        <span>{t('modelPicker.reasoningSliderMin')}</span>
        <span>{t('modelPicker.reasoningSliderMax')}</span>
      </div>

      <div
        ref={trackRef}
        className={cn('relative h-9 px-1', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}
        onClick={handleTrackClick}
        onPointerDown={event => {
          if (disabled || event.button !== 0) return
          if ((event.target as HTMLElement).closest('[data-slider-thumb]')) return
          startDrag(event.clientX)
        }}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={stepCount - 1}
        aria-valuenow={committedIndex}
        aria-valuetext={t(`thinkingLevelsShort.${value}`)}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={event => {
          if (disabled) return
          if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
            event.preventDefault()
            commitRatio(indexToRatio(committedIndex - 1, stepCount))
          }
          if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
            event.preventDefault()
            commitRatio(indexToRatio(committedIndex + 1, stepCount))
          }
        }}
      >
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border/80" />
        <div className="absolute top-1/2 h-px -translate-y-1/2 bg-primary/45 transition-[width] duration-150 ease-out" style={{ width: `${visualPercent}%` }} />

        {THINKING_LEVELS.map((level, index) => {
          const left = stepCount > 1 ? (index / (stepCount - 1)) * 100 : 0
          const isPreview = previewIndex === index
          return (
            <div
              key={level}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${left}%` }}
              onMouseEnter={() => {
                if (!disabled && !isDragging) setHoverIndex(index)
              }}
              onMouseLeave={() => {
                if (!isDragging) setHoverIndex(null)
              }}
              onPointerDown={event => event.stopPropagation()}
            >
              {showStepLabel(index) ? (
                <span className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap text-[10px] text-muted-foreground">
                  {t(`thinkingLevelsShort.${level}`)}
                </span>
              ) : null}

              <button
                type="button"
                disabled={disabled}
                aria-label={t(`thinkingLevels.${level}`)}
                className="flex size-5 items-center justify-center rounded-full"
                onClick={event => {
                  event.stopPropagation()
                  if (disabled) return
                  commitRatio(indexToRatio(index, stepCount))
                }}
              >
                <span
                  className={cn(
                    'rounded-full transition-all duration-150',
                    isPreview ? 'size-1.5 bg-primary ring-2 ring-primary/20' : 'size-1 bg-muted-foreground/30',
                  )}
                />
              </button>
            </div>
          )
        })}

        <div
          data-slider-thumb
          className={cn(
            'absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border/80 bg-background shadow-sm',
            !isDragging && 'transition-[left] duration-150 ease-out',
            isDragging && 'z-10 border-primary/40 shadow-md ring-2 ring-primary/15',
            disabled ? 'pointer-events-none' : 'cursor-grab active:cursor-grabbing',
          )}
          style={{ left: `${visualPercent}%` }}
          onPointerDown={event => {
            if (disabled) return
            event.preventDefault()
            event.stopPropagation()
            startDrag(event.clientX)
          }}
        />
      </div>
    </div>
  )
}
