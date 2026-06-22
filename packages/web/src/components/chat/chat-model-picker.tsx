import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { type ModelSelection, type ModelTier, type SessionSettingsPatch, type SessionSettingsResponse, type ThinkingLevel } from '@muse-ai/shared'
import { fetchModelStrategy } from '@/api/settings-api'
import { ReasoningLevelSlider } from '@/components/chat/reasoning-level-slider'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { MODEL_TIERS, buildModelCatalog, isSameModelSelection, resolvePickerTriggerLabels, type ModelCatalogItem } from '@/utils/model-strategy-ui'

interface ChatModelPickerProps {
  userToken: string | undefined
  sessionSettings: SessionSettingsResponse | null
  disabled: boolean
  onUpdate: (patch: SessionSettingsPatch) => Promise<boolean>
}

export function ChatModelPicker({ userToken, sessionSettings, disabled, onUpdate }: ChatModelPickerProps) {
  const { t } = useTranslation('chat')
  const containerRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [catalog, setCatalog] = useState<ModelCatalogItem[]>([])
  const [saving, setSaving] = useState(false)
  const thinkingLevel = sessionSettings?.thinkingLevel ?? 'off'
  const modelSelection = sessionSettings?.modelSelection
  const resolvedModelRef = sessionSettings?.modelRef ?? ''

  useEffect(() => {
    if (!userToken) return

    let cancelled = false
    void fetchModelStrategy(userToken)
      .then(response => {
        if (cancelled) return
        const configured = response.options.filter(option => option.authStatus === 'configured')
        setCatalog(buildModelCatalog(configured))
      })
      .catch(() => {
        if (!cancelled) setCatalog([])
      })

    return () => {
      cancelled = true
    }
  }, [userToken])

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const triggerLabels = useMemo(
    () =>
      resolvePickerTriggerLabels(modelSelection, resolvedModelRef, catalog, tier =>
        t(`modelPicker.${tier === 'high' ? 'tierHigh' : tier === 'low' ? 'tierLow' : 'tierMedium'}`),
      ),
    [catalog, modelSelection, resolvedModelRef, t],
  )
  const thinkingLevelLabel = thinkingLevel !== 'off' ? t(`thinkingLevelsShort.${thinkingLevel}`) : null

  const filteredModels = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return catalog
    return catalog.filter(item => {
      return (
        item.modelName.toLowerCase().includes(query) ||
        item.modelId.toLowerCase().includes(query) ||
        item.providerName.toLowerCase().includes(query) ||
        item.modelRef.toLowerCase().includes(query)
      )
    })
  }, [catalog, search])

  const groupedModels = useMemo(() => {
    const groups = new Map<string, { providerName: string; items: ModelCatalogItem[] }>()
    for (const item of filteredModels) {
      const existing = groups.get(item.providerId)
      if (existing) {
        existing.items.push(item)
      } else {
        groups.set(item.providerId, { providerName: item.providerName, items: [item] })
      }
    }
    return [...groups.entries()]
  }, [filteredModels])

  async function applySelection(next: ModelSelection) {
    if (!sessionSettings || isSameModelSelection(sessionSettings.modelSelection, next)) {
      setSearch('')
      setOpen(false)
      return
    }

    setSaving(true)
    const ok = await onUpdate({ modelSelection: next })
    setSaving(false)
    if (ok) {
      setSearch('')
      setOpen(false)
    }
  }

  async function applyThinking(level: ThinkingLevel) {
    if (!sessionSettings || level === sessionSettings.thinkingLevel) return

    setSaving(true)
    await onUpdate({ thinkingLevel: level })
    setSaving(false)
  }

  function isTierSelected(tier: ModelTier): boolean {
    return modelSelection?.type === 'tier' && modelSelection.tier === tier
  }

  function isModelSelected(modelRef: string): boolean {
    return modelSelection?.type === 'model' && modelSelection.modelRef === modelRef
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled || saving || !sessionSettings}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t('modelPicker.triggerAriaLabel')}
        onClick={() => {
          setOpen(value => {
            if (value) setSearch('')
            return !value
          })
        }}
        className={cn(
          'inline-flex h-7 min-w-0 max-w-[min(100%,20rem)] items-center gap-inline-sm rounded-control px-field-x text-xs transition-colors',
          'hover:bg-foreground/6 disabled:pointer-events-none disabled:opacity-50',
          open && 'bg-foreground/6',
        )}
      >
        <span className="flex min-w-0 items-center gap-1 truncate">
          <span className="truncate text-foreground">{triggerLabels.primary}</span>
          {triggerLabels.secondary ? <span className="truncate text-muted-foreground">{triggerLabels.secondary}</span> : null}
          {thinkingLevelLabel ? <span className="shrink-0 text-muted-foreground">{thinkingLevelLabel}</span> : null}
        </span>
        <ChevronDown className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} strokeWidth={2} />
      </button>

      {open ? (
        <div role="dialog" aria-label={t('modelPicker.triggerAriaLabel')} className="absolute bottom-full right-0 z-50 mb-stack w-72 ui-popover-panel">
          <div className="border-b border-border/60 px-panel-x py-menu-y">
            <Input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder={t('modelPicker.searchPlaceholder')}
              className="h-7 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              onKeyDown={event => event.stopPropagation()}
            />
          </div>

          <div className="max-h-56 overflow-y-auto ui-popover-list">
            <div className="flex flex-col gap-stack-sm">
              <p className="ui-popover-label">{t('modelPicker.tierSection')}</p>
              {MODEL_TIERS.map(tier => {
                const selected = isTierSelected(tier)
                const tierLabel = t(`modelPicker.${tier === 'high' ? 'tierHigh' : tier === 'low' ? 'tierLow' : 'tierMedium'}`)
                return (
                  <button
                    key={tier}
                    type="button"
                    disabled={disabled || saving}
                    onClick={() => void applySelection({ type: 'tier', tier })}
                    className={cn('ui-menu-item w-full rounded-control hover:bg-accent hover:text-accent-foreground', selected && 'bg-accent text-foreground')}
                  >
                    <span className="min-w-0 flex-1 truncate text-left">{tierLabel}</span>
                    {selected ? <Check className="size-3.5 shrink-0 text-foreground" /> : null}
                  </button>
                )
              })}
            </div>

            {groupedModels.length > 0 ? <div className="my-menu-y border-t border-border/60" role="separator" /> : null}

            {groupedModels.length === 0 ? (
              search.trim() ? (
                <p className="py-menu-y text-center text-xs text-muted-foreground">{t('modelPicker.empty')}</p>
              ) : null
            ) : (
              groupedModels.map(([providerId, group]) => (
                <div key={providerId} className="flex flex-col gap-stack-sm">
                  <p className="ui-popover-label">{group.providerName}</p>
                  {group.items.map(item => {
                    const selected = isModelSelected(item.modelRef)
                    return (
                      <button
                        key={item.modelRef}
                        type="button"
                        disabled={disabled || saving}
                        onClick={() => void applySelection({ type: 'model', modelRef: item.modelRef })}
                        className={cn(
                          'ui-menu-item w-full rounded-control hover:bg-accent hover:text-accent-foreground',
                          selected && 'bg-accent text-foreground',
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate text-left">{item.modelName}</span>
                        {selected ? <Check className="size-3.5 shrink-0 text-foreground" /> : null}
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>

          <div className="ui-popover-section">
            <Link to="/settings/models" className="ui-popover-link" onClick={() => setOpen(false)}>
              {t('modelPicker.editModels')}
            </Link>
          </div>

          <div className="ui-popover-section">
            <ReasoningLevelSlider value={thinkingLevel} disabled={disabled || saving} onChange={level => void applyThinking(level)} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
