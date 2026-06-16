import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { type ModelsConfigProviderOption, type SessionSettingsResponse, type ThinkingLevel } from '@muse-ai/shared'
import { fetchModelsConfig } from '@/api/settings-api'
import { ReasoningLevelSlider } from '@/components/chat/reasoning-level-slider'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface ChatModelPickerProps {
  userToken: string | undefined
  sessionSettings: SessionSettingsResponse | null
  disabled: boolean
  onUpdate: (patch: { modelRef?: string; thinkingLevel?: ThinkingLevel }) => Promise<boolean>
}

function resolveModelDisplayName(modelRef: string, options: ModelsConfigProviderOption[]): string {
  const slash = modelRef.indexOf('/')
  if (slash <= 0) return modelRef

  const providerId = modelRef.slice(0, slash)
  const modelId = modelRef.slice(slash + 1)
  const provider = options.find(item => item.id === providerId)
  const model = provider?.models.find(item => item.id === modelId)
  if (model?.name) return model.name

  return modelId
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

interface ModelListItem {
  modelRef: string
  providerId: string
  providerName: string
  modelId: string
  modelName: string
}

function buildModelList(options: ModelsConfigProviderOption[]): ModelListItem[] {
  return options.flatMap(provider =>
    provider.models.map(model => ({
      modelRef: `${provider.id}/${model.id}`,
      providerId: provider.id,
      providerName: provider.name,
      modelId: model.id,
      modelName: model.name,
    })),
  )
}

export function ChatModelPicker({ userToken, sessionSettings, disabled, onUpdate }: ChatModelPickerProps) {
  const { t } = useTranslation('chat')
  const containerRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [loadedProviderOptions, setLoadedProviderOptions] = useState<ModelsConfigProviderOption[]>([])
  const [saving, setSaving] = useState(false)
  const providerOptions = userToken ? loadedProviderOptions : []
  const thinkingLevel = sessionSettings?.thinkingLevel ?? 'off'

  useEffect(() => {
    if (!userToken) return

    let cancelled = false
    void fetchModelsConfig(userToken)
      .then(config => {
        if (!cancelled) {
          setLoadedProviderOptions(config.options.filter(option => option.authStatus === 'configured'))
        }
      })
      .catch(() => {
        if (!cancelled) setLoadedProviderOptions([])
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

  const modelRef = sessionSettings?.modelRef ?? ''
  const modelDisplayName = resolveModelDisplayName(modelRef, providerOptions).trim()
  const thinkingLevelLabel = thinkingLevel !== 'off' ? t(`thinkingLevelsShort.${thinkingLevel}`) : null

  const allModels = useMemo(() => buildModelList(providerOptions), [providerOptions])

  const filteredModels = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return allModels
    return allModels.filter(item => {
      return (
        item.modelName.toLowerCase().includes(query) ||
        item.modelId.toLowerCase().includes(query) ||
        item.providerName.toLowerCase().includes(query) ||
        item.modelRef.toLowerCase().includes(query)
      )
    })
  }, [allModels, search])

  const groupedModels = useMemo(() => {
    const groups = new Map<string, { providerName: string; items: ModelListItem[] }>()
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

  async function applyModel(nextModelRef: string) {
    if (!sessionSettings || nextModelRef === sessionSettings.modelRef) {
      setSearch('')
      setOpen(false)
      return
    }

    setSaving(true)
    const ok = await onUpdate({ modelRef: nextModelRef })
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
          <span className="truncate text-foreground">{modelDisplayName}</span>
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
            {groupedModels.length === 0 ? (
              <p className="py-menu-y text-center text-xs text-muted-foreground">{t('modelPicker.empty')}</p>
            ) : (
              groupedModels.map(([providerId, group]) => (
                <div key={providerId} className="flex flex-col gap-stack-sm">
                  <p className="ui-popover-label">{group.providerName}</p>
                  {group.items.map(item => {
                    const selected = item.modelRef === modelRef
                    return (
                      <button
                        key={item.modelRef}
                        type="button"
                        disabled={disabled || saving}
                        onClick={() => void applyModel(item.modelRef)}
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
