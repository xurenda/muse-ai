import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { thinkingLevelSchema, type ThinkingLevel } from '@museai/shared'
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

function labelClassName(level: ThinkingLevel, isActive: boolean): string {
  if (!isActive) return 'text-muted-foreground/45'

  switch (level) {
    case 'off':
      return 'reasoning-level-active-off font-medium'
    case 'minimal':
      return 'reasoning-level-active-minimal font-medium'
    case 'low':
      return 'reasoning-level-active-low font-medium'
    case 'medium':
      return 'reasoning-level-active-medium font-medium'
    case 'high':
      return 'reasoning-level-shimmer-mild font-medium'
    case 'xhigh':
      return 'reasoning-level-shimmer font-medium'
    default:
      return 'font-medium text-foreground'
  }
}

function trackFillClass(level: ThinkingLevel): string {
  switch (level) {
    case 'off':
      return 'bg-muted-foreground/35'
    case 'minimal':
      return 'bg-primary/35'
    case 'low':
      return 'bg-primary/55'
    case 'medium':
      return 'bg-primary/75'
    case 'high':
      return 'reasoning-track-premium-mild'
    case 'xhigh':
      return 'reasoning-track-premium'
    default:
      return 'bg-foreground/35'
  }
}

function thumbFillClass(level: ThinkingLevel): string {
  switch (level) {
    case 'off':
      return 'bg-muted-foreground/55'
    case 'minimal':
      return 'bg-primary/50'
    case 'low':
      return 'bg-primary/70'
    case 'medium':
      return 'bg-primary'
    case 'high':
      return 'reasoning-track-premium-mild'
    case 'xhigh':
      return 'reasoning-track-premium'
    default:
      return 'bg-foreground'
  }
}

export function ReasoningLevelSlider({ value, disabled, onChange }: ReasoningLevelSliderProps) {
  const { t } = useTranslation('chat')
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragRatio, setDragRatio] = useState<number | null>(null)
  const committedIndex = levelToIndex(value)
  const stepCount = THINKING_LEVELS.length
  const isDragging = dragRatio !== null
  const visualRatio = dragRatio ?? indexToRatio(committedIndex, stepCount)
  const activeIndex = isDragging ? ratioToIndex(visualRatio, stepCount) : committedIndex
  const activeLevel = indexToLevel(activeIndex)
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

  function stepLeft(index: number): string {
    if (stepCount <= 1) return '0%'
    return `${(index / (stepCount - 1)) * 100}%`
  }

  function labelPositionClass(index: number): string {
    if (index === 0) return 'left-0 translate-x-0'
    if (index === stepCount - 1) return 'left-full -translate-x-full'
    return '-translate-x-1/2'
  }

  return (
    <div className={cn('select-none px-menu-x pb-0.5', disabled && 'opacity-50')}>
      <div className="mb-stack-sm flex justify-between text-[10px] text-muted-foreground">
        <span>{t('modelPicker.reasoningSliderMin')}</span>
        <span>{t('modelPicker.reasoningSliderMax')}</span>
      </div>

      <div
        ref={trackRef}
        className={cn('relative h-5', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}
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
        <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-border/80" />
        <div
          className={cn('absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full transition-[width] duration-150 ease-out', trackFillClass(activeLevel))}
          style={{ width: `${visualPercent}%` }}
        />

        <div
          data-slider-thumb
          className={cn(
            'absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2',
            !isDragging && 'transition-[left] duration-150 ease-out',
            disabled ? 'pointer-events-none' : 'cursor-grab active:cursor-grabbing',
          )}
          style={{ left: `${visualPercent}%` }}
          onPointerDown={event => {
            if (disabled) return
            event.preventDefault()
            event.stopPropagation()
            startDrag(event.clientX)
          }}
        >
          <span aria-hidden className={cn('block h-[11px] w-[6px]', thumbFillClass(activeLevel))} style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} />
        </div>
      </div>

      <div className="relative mt-2 h-4">
        {THINKING_LEVELS.map((level, index) => (
          <button
            key={level}
            type="button"
            disabled={disabled}
            aria-label={t(`thinkingLevels.${level}`)}
            aria-current={index === activeIndex ? 'true' : undefined}
            className={cn(
              'absolute top-0 whitespace-nowrap text-[10px] leading-none transition-colors duration-150',
              labelPositionClass(index),
              labelClassName(level, index === activeIndex),
              !disabled && 'cursor-pointer hover:text-foreground/80',
            )}
            style={index > 0 && index < stepCount - 1 ? { left: stepLeft(index) } : undefined}
            onClick={event => {
              event.stopPropagation()
              if (disabled) return
              commitRatio(indexToRatio(index, stepCount))
            }}
            onPointerDown={event => event.stopPropagation()}
          >
            {t(`thinkingLevelsShort.${level}`)}
          </button>
        ))}
      </div>
    </div>
  )
}
