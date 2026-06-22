import { Check, ChevronDown, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { type ModelSelection, type ModelTier, type SessionSettingsPatch, type SessionSettingsResponse, type ThinkingLevel } from '@muse-ai/shared'
import { fetchModelStrategy } from '@/api/settings-api'
import { ReasoningLevelSlider } from '@/components/chat/reasoning-level-slider'
import { ModelPickerPanel } from '@/components/model-picker/model-picker-panel'
import { cn } from '@/lib/utils'
import type { ChatModelResolvedDisplay } from '@/hooks/use-chat-session'
import {
  MODEL_TIERS,
  buildModelCatalog,
  isSameModelSelection,
  resolveDisplayModelRef,
  resolveOptimisticModelRef,
  resolvePickerTriggerLabels,
  type ModelCatalogItem,
} from '@/utils/model-strategy-ui'

interface ChatModelPickerProps {
  userToken: string | undefined
  sessionSettings: SessionSettingsResponse | null
  chatModelDisplay?: ChatModelResolvedDisplay
  disabled: boolean
  onUpdate: (patch: SessionSettingsPatch) => Promise<boolean>
  /** 嵌入底部状态栏的紧凑样式 */
  statusBar?: boolean
}

export function ChatModelPicker({ userToken, sessionSettings, chatModelDisplay, disabled, onUpdate, statusBar = false }: ChatModelPickerProps) {
  const { t } = useTranslation('chat')
  const containerRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [otherModelsOpen, setOtherModelsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [catalog, setCatalog] = useState<ModelCatalogItem[]>([])
  const [pools, setPools] = useState<{ high: string[]; medium: string[]; low: string[] } | null>(null)
  const [defaultChatSelection, setDefaultChatSelection] = useState<ModelSelection | undefined>()
  const [saving, setSaving] = useState(false)
  const thinkingLevel = sessionSettings?.thinkingLevel ?? 'off'
  /** 会话未写入 selection 时，回退设置页「对话默认」（taskRouting.chat） */
  const effectiveModelSelection = sessionSettings?.modelSelection ?? defaultChatSelection

  useEffect(() => {
    if (!userToken) return

    let cancelled = false
    void fetchModelStrategy(userToken)
      .then(response => {
        if (cancelled) return
        const configured = response.options.filter(option => option.authStatus === 'configured')
        setCatalog(buildModelCatalog(configured))
        setPools(response.strategy.pools)
        setDefaultChatSelection(response.strategy.taskRouting.chat)
      })
      .catch(() => {
        if (!cancelled) {
          setCatalog([])
          setPools(null)
          setDefaultChatSelection(undefined)
        }
      })

    return () => {
      cancelled = true
    }
  }, [userToken])

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current?.contains(event.target as Node)) return
      closePopover()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (otherModelsOpen) {
          setOtherModelsOpen(false)
          setSearch('')
          return
        }
        closePopover()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, otherModelsOpen])

  function closePopover() {
    setOpen(false)
    setOtherModelsOpen(false)
    setSearch('')
  }

  const optimisticModelRef = useMemo(
    () => (pools ? resolveOptimisticModelRef(effectiveModelSelection, pools, catalog) : ''),
    [catalog, effectiveModelSelection, pools],
  )
  const tierPool = effectiveModelSelection?.type === 'tier' && pools ? pools[effectiveModelSelection.tier] : undefined
  const displayModelRef = useMemo(
    () =>
      resolveDisplayModelRef(effectiveModelSelection, {
        sseResolvedModelRef: chatModelDisplay?.resolvedModelRef,
        optimisticModelRef,
        persistedModelRef: sessionSettings?.modelRef,
        tierPool,
      }),
    [chatModelDisplay?.resolvedModelRef, effectiveModelSelection, optimisticModelRef, sessionSettings?.modelRef, tierPool],
  )

  const triggerLabels = useMemo(
    () =>
      resolvePickerTriggerLabels(effectiveModelSelection, displayModelRef, catalog, tier =>
        t(`modelPicker.${tier === 'high' ? 'tierHigh' : tier === 'low' ? 'tierLow' : 'tierMedium'}`),
      ),
    [catalog, displayModelRef, effectiveModelSelection, t],
  )
  const thinkingLevelLabel = thinkingLevel !== 'off' ? t(`thinkingLevelsShort.${thinkingLevel}`) : null

  async function applySelection(next: ModelSelection) {
    if (!sessionSettings) {
      closePopover()
      return
    }
    const current = sessionSettings.modelSelection ?? defaultChatSelection
    if (isSameModelSelection(current, next)) {
      closePopover()
      return
    }

    setSaving(true)
    const ok = await onUpdate({ modelSelection: next })
    setSaving(false)
    if (ok) closePopover()
  }

  async function applyThinking(level: ThinkingLevel) {
    if (!sessionSettings || level === sessionSettings.thinkingLevel) return

    setSaving(true)
    await onUpdate({ thinkingLevel: level })
    setSaving(false)
  }

  function isTierSelected(tier: ModelTier): boolean {
    return effectiveModelSelection?.type === 'tier' && effectiveModelSelection.tier === tier
  }

  function isOtherModelsSelected(): boolean {
    return effectiveModelSelection?.type === 'model'
  }

  function tierLabel(tier: ModelTier): string {
    return t(`modelPicker.${tier === 'high' ? 'tierHigh' : tier === 'low' ? 'tierLow' : 'tierMedium'}`)
  }

  const selectedModelRef = effectiveModelSelection?.type === 'model' ? effectiveModelSelection.modelRef : null

  return (
    <div ref={containerRef} className={cn('relative', statusBar ? 'ml-auto flex h-5 min-w-0 items-stretch' : undefined)}>
      <button
        type="button"
        disabled={disabled || saving || !sessionSettings}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t('modelPicker.triggerAriaLabel')}
        onClick={() => {
          if (open) closePopover()
          else setOpen(true)
        }}
        className={cn(
          'min-w-0 items-center transition-colors disabled:pointer-events-none disabled:opacity-50',
          statusBar
            ? cn(
                'flex h-5 max-w-[min(100%,24rem)] gap-1.5 border-0 px-2 text-[11px] leading-none',
                open ? 'bg-foreground/6 text-foreground' : 'text-muted-foreground hover:bg-foreground/6 hover:text-foreground',
              )
            : cn('inline-flex h-7 max-w-[min(100%,20rem)] gap-inline-sm rounded-control px-field-x text-xs hover:bg-foreground/6', open && 'bg-foreground/6'),
        )}
      >
        <span className="flex min-w-0 items-center gap-1 truncate">
          <span className="truncate text-foreground">{triggerLabels.primary}</span>
          {triggerLabels.secondary ? <span className="truncate text-muted-foreground">{triggerLabels.secondary}</span> : null}
          {thinkingLevelLabel ? <span className="shrink-0 text-muted-foreground">{thinkingLevelLabel}</span> : null}
        </span>
        <ChevronDown
          className={cn('shrink-0 text-muted-foreground transition-transform', statusBar ? 'size-3' : 'size-3.5', open && 'rotate-180')}
          strokeWidth={2}
        />
      </button>

      {open ? (
        <div className={cn('absolute bottom-full right-2 z-50', statusBar ? 'mb-1' : 'mb-stack')}>
          <div role="dialog" aria-label={t('modelPicker.triggerAriaLabel')} className="w-72 ui-popover-panel">
            <div className="ui-popover-list">
              {MODEL_TIERS.map(tier => {
                const selected = isTierSelected(tier)
                return (
                  <button
                    key={tier}
                    type="button"
                    disabled={disabled || saving}
                    onClick={() => void applySelection({ type: 'tier', tier })}
                    className={cn('ui-menu-item w-full rounded-control hover:bg-accent hover:text-accent-foreground', selected && 'bg-accent text-foreground')}
                  >
                    <span className="min-w-0 flex-1 truncate text-left">{tierLabel(tier)}</span>
                    {selected ? <Check className="size-3.5 shrink-0 text-foreground" strokeWidth={2} /> : null}
                  </button>
                )
              })}

              <div className="border-t border-border/60" role="separator" />

              <button
                type="button"
                disabled={disabled || saving}
                aria-expanded={otherModelsOpen}
                onClick={event => {
                  event.stopPropagation()
                  setOtherModelsOpen(value => {
                    if (value) setSearch('')
                    return !value
                  })
                }}
                className={cn(
                  'ui-menu-item w-full rounded-control hover:bg-accent hover:text-accent-foreground',
                  otherModelsOpen && 'bg-accent text-foreground',
                  isOtherModelsSelected() && !otherModelsOpen && 'bg-accent text-foreground',
                )}
              >
                <span className="min-w-0 flex-1 truncate text-left">{t('modelPicker.otherModels')}</span>
                <span className="flex shrink-0 items-center gap-1">
                  {isOtherModelsSelected() ? <Check className="size-3.5 text-foreground" strokeWidth={2} /> : null}
                  {otherModelsOpen ? (
                    <ChevronDown className="size-3.5 text-muted-foreground" strokeWidth={2} />
                  ) : (
                    <ChevronRight className="size-3.5 text-muted-foreground" strokeWidth={2} />
                  )}
                </span>
              </button>

              <Link to="/settings/models" className="ui-menu-item w-full rounded-control hover:bg-accent hover:text-accent-foreground" onClick={closePopover}>
                <span className="min-w-0 flex-1 truncate text-left">{t('modelPicker.manageModels')}</span>
              </Link>

              <div className="border-t border-border/60" role="separator" />

              <ReasoningLevelSlider value={thinkingLevel} disabled={disabled || saving} onChange={level => void applyThinking(level)} />
            </div>
          </div>

          {otherModelsOpen ? (
            <div
              role="menu"
              aria-label={t('modelPicker.otherModels')}
              className={cn('absolute bottom-0 right-full z-50 mr-1', statusBar ? 'max-h-[min(20rem,calc(100vh-6rem))]' : 'max-h-80')}
            >
              <ModelPickerPanel
                searchPlaceholder={t('modelPicker.searchPlaceholder')}
                search={search}
                onSearchChange={setSearch}
                catalog={catalog}
                selectionMode="single"
                selectedModelRef={selectedModelRef}
                onModelSelect={modelRef => void applySelection({ type: 'model', modelRef })}
                emptyMessage={t('modelPicker.empty')}
                disabled={disabled || saving}
                autoFocusSearch
                maxHeightClassName={statusBar ? 'max-h-[min(20rem,calc(100vh-6rem))]' : 'max-h-80'}
                onSearchKeyDown={event => event.stopPropagation()}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
