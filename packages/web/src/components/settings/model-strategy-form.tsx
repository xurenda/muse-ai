import type { ModelSelection, ModelStrategyConfig, ModelsConfigProviderOption, ModelTier, TaskModelSelection } from '@muse-ai/shared'
import { ChevronDown, ChevronRight, CircleHelp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SettingsFieldRow } from '@/components/settings/settings-field-row'
import { ModelPoolAddPicker } from '@/components/settings/model-pool-add-picker'
import { ModelPoolDraggableList } from '@/components/settings/model-pool-draggable-list'
import { SettingsRow } from '@/components/settings/settings-row'
import { SettingsSection } from '@/components/settings/settings-section'
import { Select } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  MODEL_TIERS,
  buildModelCatalog,
  decodeModelSelection,
  decodeTaskModelSelection,
  encodeFollowChatValue,
  encodeModelSelection,
  encodeModelValue,
  encodeTaskModelSelection,
  encodeTierValue,
  tierLabelKey,
  tierDescKey,
  type ModelCatalogItem,
} from '@/utils/model-strategy-ui'

interface ModelStrategyFormProps {
  strategy: ModelStrategyConfig
  options: ModelsConfigProviderOption[]
  onChange: (next: ModelStrategyConfig) => void
}

type TaskRoutingField = 'chat' | 'compaction' | 'titleGeneration'

interface ModelPoolTierEditorProps {
  tier: ModelTier
  pool: string[]
  catalog: ModelCatalogItem[]
  expanded: boolean
  onToggle: () => void
  onChange: (nextPool: string[]) => void
}

function ModelPoolTierEditor({ tier, pool, catalog, expanded, onToggle, onChange }: ModelPoolTierEditorProps) {
  const { t } = useTranslation('settings')

  const trailingLabel = pool.length === 0 ? t('models.strategy.emptyTier') : t('models.strategy.poolCount', { count: pool.length })

  return (
    <SettingsRow
      title={t(`models.strategy.${tierLabelKey(tier)}`)}
      onClick={onToggle}
      expanded={
        expanded ? (
          <div className="flex flex-col gap-0.5">
            {pool.length > 0 ? <ModelPoolDraggableList droppableId={`pool-${tier}`} pool={pool} catalog={catalog} onChange={onChange} /> : null}
            <ModelPoolAddPicker catalog={catalog} pool={pool} onChange={onChange} />
          </div>
        ) : undefined
      }
    >
      <span className={cn('text-sm', pool.length === 0 ? 'text-destructive' : 'text-muted-foreground')}>{trailingLabel}</span>
      {expanded ? (
        <ChevronDown className="size-4 text-muted-foreground" strokeWidth={2} />
      ) : (
        <ChevronRight className="size-4 text-muted-foreground" strokeWidth={2} />
      )}
    </SettingsRow>
  )
}

export function ModelStrategyForm({ strategy, options, onChange }: ModelStrategyFormProps) {
  const { t } = useTranslation('settings')
  const catalog = useMemo(() => buildModelCatalog(options), [options])
  const [expandedTier, setExpandedTier] = useState<ModelTier | null>('medium')

  const tierOptions = useMemo(
    () =>
      MODEL_TIERS.map(tier => ({
        value: encodeTierValue(tier),
        label: t(`models.strategy.${tierLabelKey(tier)}`),
      })),
    [t],
  )

  const modelOptions = useMemo(
    () => catalog.map(item => ({ value: encodeModelValue(item.modelRef), label: `${item.modelName} (${item.providerName})` })),
    [catalog],
  )

  const chatRoutingOptions = useMemo(() => [...tierOptions, ...modelOptions], [tierOptions, modelOptions])

  const auxiliaryRoutingOptions = useMemo(
    () => [{ value: encodeFollowChatValue(), label: t('models.strategy.selectionFollowChat') }, ...tierOptions, ...modelOptions],
    [t, tierOptions, modelOptions],
  )

  const updatePool = (tier: ModelTier, nextPool: string[]) => {
    onChange({
      ...strategy,
      pools: {
        ...strategy.pools,
        [tier]: nextPool,
      },
    })
  }

  const updateTaskRouting = (field: TaskRoutingField, selection: ModelSelection | TaskModelSelection) => {
    onChange({
      ...strategy,
      taskRouting: {
        ...strategy.taskRouting,
        [field]: selection,
      },
    })
  }

  const handleRoutingChange = (field: TaskRoutingField, value: string) => {
    if (field === 'chat') {
      const decoded = decodeModelSelection(value, catalog)
      if (decoded) updateTaskRouting(field, decoded)
      return
    }
    const decoded = decodeTaskModelSelection(value, catalog, true)
    if (decoded) updateTaskRouting(field, decoded)
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex max-w-2xl flex-col gap-6 px-1">
        <SettingsSection
          title={t('models.strategy.poolsTitle')}
          titleHint={
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
                  aria-label={t('models.strategy.poolsDescription')}
                >
                  <CircleHelp className="size-3.5" strokeWidth={2} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-sm">
                <p className="text-sm">{t('models.strategy.poolsDescription')}</p>
                <ul className="mt-2 space-y-1.5 border-t border-border/60 pt-2 text-sm text-muted-foreground">
                  {MODEL_TIERS.map(tier => (
                    <li key={tier}>
                      <span className="font-medium text-foreground">{t(`models.strategy.${tierLabelKey(tier)}`)}</span>
                      <span aria-hidden>：</span>
                      {t(`models.strategy.${tierDescKey(tier)}`)}
                    </li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          }
        >
          {MODEL_TIERS.map(tier => (
            <ModelPoolTierEditor
              key={tier}
              tier={tier}
              pool={strategy.pools[tier]}
              catalog={catalog}
              expanded={expandedTier === tier}
              onToggle={() => setExpandedTier(current => (current === tier ? null : tier))}
              onChange={nextPool => updatePool(tier, nextPool)}
            />
          ))}
        </SettingsSection>

        <SettingsSection
          title={t('models.strategy.routingTitle')}
          footer={<p className="px-1 text-sm text-muted-foreground">{t('models.strategy.routingDescription')}</p>}
        >
          <div className="flex flex-col gap-4 px-4 py-3.5">
            <SettingsFieldRow label={t('models.strategy.taskChat')}>
              <Select
                value={encodeModelSelection(strategy.taskRouting.chat)}
                options={chatRoutingOptions}
                onValueChange={value => handleRoutingChange('chat', value)}
              />
            </SettingsFieldRow>
            <SettingsFieldRow label={t('models.strategy.taskCompaction')}>
              <Select
                value={encodeTaskModelSelection(strategy.taskRouting.compaction)}
                options={auxiliaryRoutingOptions}
                onValueChange={value => handleRoutingChange('compaction', value)}
              />
            </SettingsFieldRow>
            <SettingsFieldRow label={t('models.strategy.taskTitle')}>
              <Select
                value={encodeTaskModelSelection(strategy.taskRouting.titleGeneration)}
                options={auxiliaryRoutingOptions}
                onValueChange={value => handleRoutingChange('titleGeneration', value)}
              />
            </SettingsFieldRow>
          </div>
        </SettingsSection>
      </div>
    </TooltipProvider>
  )
}
