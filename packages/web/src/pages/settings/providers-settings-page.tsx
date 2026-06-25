import { CUSTOM_PROVIDER_API_OPTIONS } from '@museai/shared'
import type { CustomProviderItem, ProviderAdvancedConfig, ProviderAuthStatus, ProvidersConfigResponse } from '@museai/shared'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { HeadersEditor } from '@/components/settings/headers-editor'
import { emptyProviderAdvanced, ProviderAdvancedForm } from '@/components/settings/provider-advanced-form'
import { ProviderAuthStatus as ProviderAuthStatusIndicator } from '@/components/settings/provider-auth-status'
import { SettingsFieldRow } from '@/components/settings/settings-field-row'
import { SettingsRow } from '@/components/settings/settings-row'
import { SettingsSection } from '@/components/settings/settings-section'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useTranslation } from 'react-i18next'
import {
  deleteCustomProvider,
  deleteProviderApiKey,
  fetchProvidersConfig,
  saveCustomProvider,
  saveProviderAdvancedConfig,
  saveProviderApiKey,
} from '@/api/settings-api'
import { useAuth } from '@/hooks/use-auth'

interface CustomProviderFormState {
  id: string
  baseUrl: string
  api: string
  apiKey: string
  headers: Array<{ key: string; value: string }>
  models: Array<{ id: string; name: string; headers: Array<{ key: string; value: string }> }>
}

const NEW_CUSTOM_PROVIDER_ID = '__new__'
const DEFAULT_VISIBLE_PROVIDER_COUNT = 5

const emptyCustomForm = (): CustomProviderFormState => ({
  id: '',
  baseUrl: 'http://127.0.0.1:11434/v1',
  api: CUSTOM_PROVIDER_API_OPTIONS[0].value,
  apiKey: '',
  headers: [],
  models: [{ id: '', name: '', headers: [] }],
})

function cloneAdvancedConfig(config?: ProviderAdvancedConfig): ProviderAdvancedConfig {
  if (!config) {
    return emptyProviderAdvanced()
  }
  return {
    baseUrl: config.baseUrl ?? '',
    headers: config.headers.map(header => ({ ...header })),
    extraModels: config.extraModels.map(model => ({
      ...model,
      headers: model.headers.map(header => ({ ...header })),
    })),
  }
}

function customFormFromProvider(provider: CustomProviderItem): CustomProviderFormState {
  return {
    id: provider.id,
    baseUrl: provider.baseUrl,
    api: provider.api,
    apiKey: provider.apiKey ?? '',
    headers: provider.headers.map(header => ({ ...header })),
    models: provider.models.map(model => ({
      id: model.id,
      name: model.name,
      headers: model.headers.map(header => ({ ...header })),
    })),
  }
}

function formatCustomProviderModels(provider: CustomProviderItem): string {
  return provider.models.map(model => model.name || model.id).join(', ')
}

function getApiKeyPlaceholder(provider: { authStatus: ProviderAuthStatus; apiKeyMask?: string }, draft: string | undefined, pastePlaceholder: string): string {
  if (draft?.trim()) {
    return pastePlaceholder
  }
  if (provider.authStatus !== 'missing' && provider.apiKeyMask) {
    return provider.apiKeyMask
  }
  return pastePlaceholder
}

function sortApiKeyProviders<T extends { authStatus: ProviderAuthStatus }>(providers: T[]): T[] {
  return [...providers].sort((left, right) => {
    const leftConfigured = left.authStatus !== 'missing'
    const rightConfigured = right.authStatus !== 'missing'
    if (leftConfigured === rightConfigured) {
      return 0
    }
    return leftConfigured ? -1 : 1
  })
}

interface SettingsListExpandToggleProps {
  expanded: boolean
  hiddenCount: number
  showMoreLabel: string
  showLessLabel: string
  onToggle: () => void
}

function SettingsListExpandToggle({ expanded, hiddenCount, showMoreLabel, showLessLabel, onToggle }: SettingsListExpandToggleProps) {
  if (hiddenCount <= 0) {
    return null
  }

  return (
    <button
      type="button"
      className="flex w-full cursor-pointer items-center justify-center gap-1 px-1 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      onClick={onToggle}
    >
      {expanded ? showLessLabel : showMoreLabel}
      <ChevronDown className={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`} strokeWidth={2} />
    </button>
  )
}

export function ProvidersSettingsPage() {
  const { t } = useTranslation('settings')
  const { auth, getValidAccessToken } = useAuth()
  const [config, setConfig] = useState<ProvidersConfigResponse | null>(null)
  const [apiKeyDrafts, setApiKeyDrafts] = useState<Record<string, string>>({})
  const [advancedDrafts, setAdvancedDrafts] = useState<Record<string, ProviderAdvancedConfig>>({})
  const [expandedProviderId, setExpandedProviderId] = useState<string | null>(null)
  const [expandedCustomId, setExpandedCustomId] = useState<string | null>(null)
  const [apiKeyListExpanded, setApiKeyListExpanded] = useState(false)
  const [customListExpanded, setCustomListExpanded] = useState(false)
  const [customForm, setCustomForm] = useState<CustomProviderFormState>(emptyCustomForm)
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  useEffect(() => {
    if (!auth) return

    let cancelled = false
    void (async () => {
      try {
        const token = await getValidAccessToken()
        const next = await fetchProvidersConfig(token)
        if (!cancelled) {
          setConfig(next)
        }
      } catch (loadError) {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : String(loadError)
          toast.error(message)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [auth, getValidAccessToken])

  const refreshConfig = useCallback(async () => {
    if (!auth) return

    try {
      const token = await getValidAccessToken()
      const next = await fetchProvidersConfig(token)
      setConfig(next)
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : String(loadError)
      toast.error(message)
    }
  }, [auth, getValidAccessToken])

  const handleSaveProvider = async (providerId: string) => {
    if (!auth) return
    const apiKey = apiKeyDrafts[providerId]?.trim()
    const advanced = advancedDrafts[providerId] ?? emptyProviderAdvanced()

    setBusyKey(`provider:${providerId}`)
    try {
      const token = await getValidAccessToken()
      if (apiKey) {
        await saveProviderApiKey(token, providerId, { apiKey })
        setApiKeyDrafts(current => ({ ...current, [providerId]: '' }))
      }

      const extraModels = advanced.extraModels
        .map(model => ({
          id: model.id.trim(),
          name: model.name.trim() || undefined,
          headers: model.headers.filter(header => header.key.trim()),
        }))
        .filter(model => model.id)

      await saveProviderAdvancedConfig(token, providerId, {
        baseUrl: advanced.baseUrl?.trim() || undefined,
        headers: advanced.headers.filter(header => header.key.trim()),
        extraModels,
      })

      setExpandedProviderId(null)
      await refreshConfig()
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : String(saveError)
      toast.error(message)
    } finally {
      setBusyKey(null)
    }
  }

  const handleDeleteApiKey = async (providerId: string) => {
    if (!auth) return
    setBusyKey(`api-key-clear:${providerId}`)
    try {
      const token = await getValidAccessToken()
      await deleteProviderApiKey(token, providerId)
      await refreshConfig()
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : String(deleteError)
      toast.error(message)
    } finally {
      setBusyKey(null)
    }
  }

  const resetCustomForm = () => {
    setExpandedCustomId(null)
    setCustomForm(emptyCustomForm())
  }

  const openAddCustomForm = () => {
    setExpandedCustomId(NEW_CUSTOM_PROVIDER_ID)
    setCustomForm(emptyCustomForm())
  }

  const toggleCustomProvider = (provider: CustomProviderItem) => {
    setExpandedCustomId(current => {
      if (current === provider.id) {
        return null
      }
      setCustomForm(customFormFromProvider(provider))
      return provider.id
    })
  }

  const handleClearCustom = () => {
    if (expandedCustomId === NEW_CUSTOM_PROVIDER_ID) {
      resetCustomForm()
      return
    }
    if (expandedCustomId) {
      void handleDeleteCustom(expandedCustomId)
    }
  }

  const handleSaveCustom = async () => {
    if (!auth) return
    const providerId = customForm.id.trim()
    const models = customForm.models
      .map(model => ({
        id: model.id.trim(),
        name: model.name.trim() || undefined,
        headers: model.headers.filter(header => header.key.trim()),
      }))
      .filter(model => model.id)

    if (!providerId) {
      toast.error(t('providers.custom.idRequired'))
      return
    }
    if (!customForm.baseUrl.trim()) {
      toast.error(t('providers.custom.baseUrlRequired'))
      return
    }
    if (!models.length) {
      toast.error(t('providers.custom.modelsRequired'))
      return
    }
    if (!customForm.apiKey.trim()) {
      toast.error(t('providers.apiKeyRequired'))
      return
    }

    setBusyKey('custom-save')
    try {
      const token = await getValidAccessToken()
      await saveCustomProvider(token, providerId, {
        baseUrl: customForm.baseUrl.trim(),
        api: customForm.api,
        apiKey: customForm.apiKey.trim(),
        headers: customForm.headers.filter(header => header.key.trim()),
        models,
      })
      resetCustomForm()
      await refreshConfig()
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : String(saveError)
      toast.error(message)
    } finally {
      setBusyKey(null)
    }
  }

  const handleDeleteCustom = async (providerId: string) => {
    if (!auth) return
    setBusyKey(`custom-delete:${providerId}`)
    try {
      const token = await getValidAccessToken()
      await deleteCustomProvider(token, providerId)
      if (expandedCustomId === providerId) {
        resetCustomForm()
      }
      await refreshConfig()
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : String(deleteError)
      toast.error(message)
    } finally {
      setBusyKey(null)
    }
  }

  const toggleProvider = (providerId: string, readOnly: boolean, advanced?: ProviderAdvancedConfig) => {
    if (readOnly) {
      return
    }
    setExpandedProviderId(current => {
      const next = current === providerId ? null : providerId
      if (next === providerId) {
        setAdvancedDrafts(drafts => ({
          ...drafts,
          [providerId]: cloneAdvancedConfig(advanced),
        }))
      }
      return next
    })
  }

  const isEditingCustom = expandedCustomId !== null && expandedCustomId !== NEW_CUSTOM_PROVIDER_ID

  const sortedApiKeyProviders = useMemo(() => sortApiKeyProviders(config?.apiKeyProviders ?? []), [config?.apiKeyProviders])
  const customProviders = config?.customProviders ?? []
  const hiddenApiKeyCount = Math.max(0, sortedApiKeyProviders.length - DEFAULT_VISIBLE_PROVIDER_COUNT)
  const hiddenCustomCount = Math.max(0, customProviders.length - DEFAULT_VISIBLE_PROVIDER_COUNT)
  const showAllApiKeyProviders =
    apiKeyListExpanded ||
    (expandedProviderId !== null && sortedApiKeyProviders.findIndex(provider => provider.id === expandedProviderId) >= DEFAULT_VISIBLE_PROVIDER_COUNT)
  const showAllCustomProviders =
    customListExpanded ||
    (expandedCustomId !== null &&
      expandedCustomId !== NEW_CUSTOM_PROVIDER_ID &&
      customProviders.findIndex(provider => provider.id === expandedCustomId) >= DEFAULT_VISIBLE_PROVIDER_COUNT)
  const visibleApiKeyProviders = showAllApiKeyProviders ? sortedApiKeyProviders : sortedApiKeyProviders.slice(0, DEFAULT_VISIBLE_PROVIDER_COUNT)
  const visibleCustomProviders = showAllCustomProviders ? customProviders : customProviders.slice(0, DEFAULT_VISIBLE_PROVIDER_COUNT)

  if (!auth) return null

  const renderCustomProviderForm = (isNew: boolean) => (
    <div className="flex flex-col gap-4" onClick={event => event.stopPropagation()}>
      <div className="flex items-center justify-between gap-3">
        {isNew ? <p className="text-sm font-medium">{t('providers.custom.addTitle')}</p> : <span />}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button type="button" size="sm" disabled={busyKey === 'custom-save'} onClick={() => void handleSaveCustom()}>
            {busyKey === 'custom-save' ? t('providers.saving') : t('providers.save')}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={!isNew && busyKey === `custom-delete:${expandedCustomId}`} onClick={handleClearCustom}>
            {isNew ? t('providers.custom.cancel') : t('providers.clear')}
          </Button>
        </div>
      </div>

      <SettingsFieldRow label={t('providers.custom.id')}>
        <Input
          value={customForm.id}
          disabled={isEditingCustom}
          placeholder="ollama"
          onChange={event => setCustomForm(current => ({ ...current, id: event.target.value }))}
        />
      </SettingsFieldRow>

      <SettingsFieldRow label={t('providers.custom.baseUrl')}>
        <Input value={customForm.baseUrl} onChange={event => setCustomForm(current => ({ ...current, baseUrl: event.target.value }))} />
      </SettingsFieldRow>

      <SettingsFieldRow label={t('providers.custom.api')}>
        <Select
          value={customForm.api}
          options={CUSTOM_PROVIDER_API_OPTIONS.map(option => ({
            value: option.value,
            label: option.label,
          }))}
          onValueChange={api => setCustomForm(current => ({ ...current, api }))}
        />
      </SettingsFieldRow>

      <SettingsFieldRow label={t('providers.apiKey')}>
        <Input
          type="password"
          placeholder={t('providers.apiKeyPlaceholder')}
          value={customForm.apiKey}
          required
          onChange={event => setCustomForm(current => ({ ...current, apiKey: event.target.value }))}
        />
      </SettingsFieldRow>

      <HeadersEditor
        label={t('providers.advanced.headers')}
        headers={customForm.headers}
        keyPlaceholder={t('providers.advanced.headerKey')}
        valuePlaceholder={t('providers.advanced.headerValue')}
        addLabel={t('providers.advanced.addHeader')}
        onChange={headers => setCustomForm(current => ({ ...current, headers }))}
      />

      <div className="flex flex-col gap-2">
        <span className="text-sm text-muted-foreground">{t('providers.custom.models')}</span>
        {customForm.models.map((model, index) => (
          <div key={index} className="flex flex-col gap-2 rounded-lg border border-border/70 p-3">
            <div className="flex items-center gap-2">
              <Input
                className="min-w-0 flex-1"
                placeholder={t('providers.custom.modelId')}
                value={model.id}
                onChange={event =>
                  setCustomForm(current => ({
                    ...current,
                    models: current.models.map((item, itemIndex) => (itemIndex === index ? { ...item, id: event.target.value } : item)),
                  }))
                }
              />
              <Input
                className="min-w-0 flex-1"
                placeholder={t('providers.custom.modelName')}
                value={model.name}
                onChange={event =>
                  setCustomForm(current => ({
                    ...current,
                    models: current.models.map((item, itemIndex) => (itemIndex === index ? { ...item, name: event.target.value } : item)),
                  }))
                }
              />
              <IconButton
                type="button"
                aria-label={t('providers.custom.removeModel')}
                tooltip={t('providers.custom.removeModel')}
                disabled={customForm.models.length <= 1}
                onClick={() =>
                  setCustomForm(current => ({
                    ...current,
                    models: current.models.filter((_, itemIndex) => itemIndex !== index),
                  }))
                }
              >
                <Trash2 className="size-3.5" strokeWidth={2} />
              </IconButton>
            </div>
            <HeadersEditor
              label={t('providers.advanced.modelHeaders')}
              headers={model.headers}
              keyPlaceholder={t('providers.advanced.headerKey')}
              valuePlaceholder={t('providers.advanced.headerValue')}
              addLabel={t('providers.advanced.addHeader')}
              onChange={headers =>
                setCustomForm(current => ({
                  ...current,
                  models: current.models.map((item, itemIndex) => (itemIndex === index ? { ...item, headers } : item)),
                }))
              }
            />
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-fit"
          onClick={() =>
            setCustomForm(current => ({
              ...current,
              models: [...current.models, { id: '', name: '', headers: [] }],
            }))
          }
        >
          <Plus className="size-3.5" strokeWidth={2} />
          {t('providers.custom.addModel')}
        </Button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-full flex-col bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-8">
        <div className="flex flex-col gap-1 px-1">
          <h1 className="text-lg font-semibold">{t('nav.providers')}</h1>
          <p className="text-sm text-muted-foreground">{t('providers.description')}</p>
        </div>

        {loading ? <p className="px-1 text-sm text-muted-foreground">{t('providers.loading')}</p> : null}

        <SettingsSection
          title={t('providers.apiKeySection')}
          footer={
            <SettingsListExpandToggle
              expanded={showAllApiKeyProviders}
              hiddenCount={hiddenApiKeyCount}
              showMoreLabel={t('providers.showMore')}
              showLessLabel={t('providers.showLess')}
              onToggle={() => setApiKeyListExpanded(current => !current)}
            />
          }
        >
          <TooltipProvider>
            {visibleApiKeyProviders.map(provider => {
              const isExpanded = expandedProviderId === provider.id
              const isConfigured = provider.authStatus !== 'missing'
              const statusLabel = isConfigured ? t('providers.authStatus.configured') : t('providers.authStatus.missing')
              const configuredTooltip = isConfigured ? t('providers.itemDescription.configured') : undefined

              return (
                <SettingsRow
                  key={provider.id}
                  title={provider.name}
                  onClick={() => toggleProvider(provider.id, false, provider.advanced)}
                  expanded={
                    isExpanded ? (
                      <div className="flex flex-col gap-4" onClick={event => event.stopPropagation()}>
                        <SettingsFieldRow label={t('providers.apiKey')}>
                          <Input
                            type="password"
                            placeholder={getApiKeyPlaceholder(provider, apiKeyDrafts[provider.id], t('providers.apiKeyPlaceholder'))}
                            value={apiKeyDrafts[provider.id] ?? ''}
                            onChange={event =>
                              setApiKeyDrafts(current => ({
                                ...current,
                                [provider.id]: event.target.value,
                              }))
                            }
                          />
                        </SettingsFieldRow>

                        <ProviderAdvancedForm
                          value={advancedDrafts[provider.id] ?? cloneAdvancedConfig(provider.advanced)}
                          onChange={next => setAdvancedDrafts(current => ({ ...current, [provider.id]: next }))}
                          actions={
                            <>
                              <Button
                                type="button"
                                size="sm"
                                disabled={busyKey === `provider:${provider.id}`}
                                onClick={() => void handleSaveProvider(provider.id)}
                              >
                                {busyKey === `provider:${provider.id}` ? t('providers.saving') : t('providers.save')}
                              </Button>
                              {provider.authStatus === 'configured' ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={busyKey === `api-key-clear:${provider.id}`}
                                  onClick={() => void handleDeleteApiKey(provider.id)}
                                >
                                  {t('providers.clear')}
                                </Button>
                              ) : null}
                            </>
                          }
                        />
                      </div>
                    ) : undefined
                  }
                >
                  <ProviderAuthStatusIndicator configured={isConfigured} label={statusLabel} tooltip={configuredTooltip} />
                  <ChevronRight className={`size-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} strokeWidth={2} />
                </SettingsRow>
              )
            })}
          </TooltipProvider>
        </SettingsSection>

        <SettingsSection
          title={t('providers.customSection')}
          action={
            expandedCustomId !== NEW_CUSTOM_PROVIDER_ID ? (
              <Button type="button" size="sm" variant="outline" onClick={openAddCustomForm}>
                <Plus className="size-3.5" strokeWidth={2} />
                {t('providers.custom.add')}
              </Button>
            ) : null
          }
          footer={
            <SettingsListExpandToggle
              expanded={showAllCustomProviders}
              hiddenCount={hiddenCustomCount}
              showMoreLabel={t('providers.showMore')}
              showLessLabel={t('providers.showLess')}
              onToggle={() => setCustomListExpanded(current => !current)}
            />
          }
        >
          {visibleCustomProviders.map(provider => {
            const isExpanded = expandedCustomId === provider.id
            const modelsLabel = formatCustomProviderModels(provider)

            return (
              <SettingsRow
                key={provider.id}
                title={provider.id}
                onClick={() => toggleCustomProvider(provider)}
                expanded={isExpanded ? renderCustomProviderForm(false) : undefined}
              >
                {modelsLabel ? (
                  <span className="max-w-40 truncate text-sm text-muted-foreground" title={modelsLabel}>
                    {modelsLabel}
                  </span>
                ) : null}
                <ChevronRight className={`size-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} strokeWidth={2} />
              </SettingsRow>
            )
          })}

          {!customProviders.length && expandedCustomId !== NEW_CUSTOM_PROVIDER_ID ? (
            <div className="mx-2 px-2 py-3.5 text-sm text-muted-foreground">{t('providers.custom.empty')}</div>
          ) : null}

          {expandedCustomId === NEW_CUSTOM_PROVIDER_ID ? <div className="px-4 py-3.5">{renderCustomProviderForm(true)}</div> : null}
        </SettingsSection>
      </div>
    </div>
  )
}
