import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RIGHT_PANEL_TAB_DEFINITIONS } from '@/constants/right-panel-tabs'
import { useRightPanelStore } from '@/stores/right-panel'
import { cn } from '@/lib/utils'

interface ScrollEdgeFade {
  left: boolean
  right: boolean
}

function useHorizontalScrollEdgeFade(tabCount: number) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [fade, setFade] = useState<ScrollEdgeFade>({ left: false, right: false })

  const updateFade = useCallback(() => {
    const element = scrollRef.current
    if (!element) {
      return
    }

    const { scrollLeft, scrollWidth, clientWidth } = element
    const overflow = scrollWidth - clientWidth > 1

    setFade({
      left: overflow && scrollLeft > 1,
      right: overflow && scrollLeft + clientWidth < scrollWidth - 1,
    })
  }, [])

  useEffect(() => {
    const element = scrollRef.current
    if (!element) {
      return
    }

    updateFade()

    element.addEventListener('scroll', updateFade, { passive: true })
    const resizeObserver = new ResizeObserver(updateFade)
    resizeObserver.observe(element)

    return () => {
      element.removeEventListener('scroll', updateFade)
      resizeObserver.disconnect()
    }
  }, [tabCount, updateFade])

  return { scrollRef, fade }
}

export function RightPanelTabList() {
  const { t } = useTranslation('layout')
  const availableTabTypes = useRightPanelStore(state => state.availableTabTypes)
  const activeTab = useRightPanelStore(state => state.activeTab)
  const setActiveTab = useRightPanelStore(state => state.setActiveTab)
  const { scrollRef, fade } = useHorizontalScrollEdgeFade(availableTabTypes.length)

  if (availableTabTypes.length === 0) {
    return null
  }

  return (
    <div className="relative min-w-0">
      {fade.left ? (
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-10 w-5 bg-gradient-to-r from-background to-transparent" />
      ) : null}
      {fade.right ? (
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 w-5 bg-gradient-to-l from-background to-transparent" />
      ) : null}

      <div ref={scrollRef} className="ui-scrollbar-hidden flex min-w-0 items-center gap-0.5 overflow-x-auto" role="tablist">
        {availableTabTypes.map(type => {
          const definition = RIGHT_PANEL_TAB_DEFINITIONS[type]
          const Icon = definition.icon
          const selected = type === activeTab
          const label = t(definition.labelKey)

          return (
            <button
              key={type}
              type="button"
              role="tab"
              aria-selected={selected}
              className={cn(
                'flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors',
                selected ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}
              onClick={() => setActiveTab(type)}
            >
              <Icon className="size-3.5 shrink-0" strokeWidth={2} />
              <span className="truncate">{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
