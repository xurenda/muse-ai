import type {
  ModelSelection,
  ModelStrategyConfig,
  ModelStrategyPools,
  ModelStrategyTaskRouting,
  ModelsConfigProviderOption,
  ModelTier,
  TaskModelSelection,
} from '@muse-ai/shared'
import { ChevronDown, ChevronRight, CircleHelp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ModelPickerMenu, type ModelPickerQuickOption } from '@/components/model-picker/model-picker-menu'
import { ModelPoolAddPicker } from '@/components/settings/model-pool-add-picker'
import { ModelPoolDraggableList } from '@/components/settings/model-pool-draggable-list'
import { SettingsRow } from '@/components/settings/settings-row'
import { SettingsSection } from '@/components/settings/settings-section'
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
  resolveEncodedSelectionLabel,
  tierLabelKey,
  tierDescKey,
  type ModelCatalogItem,
} from '@/utils/model-strategy-ui'

interface ModelStrategyFormProps {
  strategy: ModelStrategyConfig
  options: ModelsConfigProviderOption[]
  onPoolsChange: (pools: ModelStrategyPools) => void
  onTaskRoutingChange: (taskRouting: ModelStrategyTaskRouting) => void
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

interface TaskRoutingRowProps {
  label: string
  value: string
  catalog: ModelCatalogItem[]
  quickOptions: ModelPickerQuickOption[]
  onValueChange: (value: string) => void
  searchPlaceholder: string
}

/** 辅助模型行：与模型组列表一致的左右布局 */
function TaskRoutingRow({ label, value, catalog, quickOptions, onValueChange, searchPlaceholder }: TaskRoutingRowProps) {
  const { t } = useTranslation('settings')
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const displayLabel = useMemo(
    () =>
      resolveEncodedSelectionLabel(value, catalog, {
        followChatLabel: t('models.strategy.selectionFollowChat'),
        tierLabel: tier => t(`models.strategy.${tierLabelKey(tier)}`),
      }),
    [catalog, t, value],
  )

  const selectedModelRef = value.startsWith('model:') ? value.slice('model:'.length) : null

  const quickOptionsWithSelection = useMemo(() => quickOptions.map(option => ({ ...option, selected: option.id === value })), [quickOptions, value])

  return (
    <SettingsRow title={label}>
      <ModelPickerMenu
        open={open}
        onOpenChange={nextOpen => {
          setOpen(nextOpen)
          if (!nextOpen) setSearch('')
        }}
        align="end"
        searchPlaceholder={searchPlaceholder}
        search={search}
        onSearchChange={setSearch}
        catalog={catalog}
        quickOptions={quickOptionsWithSelection}
        onQuickOptionSelect={onValueChange}
        selectionMode="single"
        selectedModelRef={selectedModelRef}
        onModelSelect={modelRef => onValueChange(encodeModelValue(modelRef))}
        emptyMessage={t('models.strategy.emptySearch')}
        autoFocusSearch
        trigger={
          <button
            type="button"
            className="inline-flex max-w-[11rem] shrink-0 cursor-pointer items-center gap-1 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground data-[state=open]:text-foreground"
          >
            <span className="truncate">{displayLabel}</span>
            <ChevronDown className="size-4 shrink-0" strokeWidth={2} />
          </button>
        }
      />
    </SettingsRow>
  )
}

export function ModelStrategyForm({ strategy, options, onPoolsChange, onTaskRoutingChange }: ModelStrategyFormProps) {
  const { t } = useTranslation('settings')
  const catalog = useMemo(() => buildModelCatalog(options), [options])
  const [expandedTier, setExpandedTier] = useState<ModelTier | null>(null)

  const tierQuickOptions = useMemo<ModelPickerQuickOption[]>(
    () =>
      MODEL_TIERS.map(tier => ({
        id: encodeTierValue(tier),
        label: t(`models.strategy.${tierLabelKey(tier)}`),
      })),
    [t],
  )

  const auxiliaryQuickOptions = useMemo<ModelPickerQuickOption[]>(
    () => [{ id: encodeFollowChatValue(), label: t('models.strategy.selectionFollowChat') }, ...tierQuickOptions],
    [t, tierQuickOptions],
  )

  const updatePool = (tier: ModelTier, nextPool: string[]) => {
    onPoolsChange({
      ...strategy.pools,
      [tier]: nextPool,
    })
  }

  const updateTaskRouting = (field: TaskRoutingField, selection: ModelSelection | TaskModelSelection) => {
    onTaskRoutingChange({
      ...strategy.taskRouting,
      [field]: selection,
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
          titleHint={
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
                  aria-label={t('models.strategy.routingTitleHint')}
                >
                  <CircleHelp className="size-3.5" strokeWidth={2} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-sm">
                <p className="text-sm">{t('models.strategy.routingTitleHint')}</p>
              </TooltipContent>
            </Tooltip>
          }
        >
          <TaskRoutingRow
            label={t('models.strategy.taskChat')}
            value={encodeModelSelection(strategy.taskRouting.chat)}
            catalog={catalog}
            quickOptions={tierQuickOptions}
            searchPlaceholder={t('models.strategy.searchModel')}
            onValueChange={value => handleRoutingChange('chat', value)}
          />
          <TaskRoutingRow
            label={t('models.strategy.taskCompaction')}
            value={encodeTaskModelSelection(strategy.taskRouting.compaction)}
            catalog={catalog}
            quickOptions={auxiliaryQuickOptions}
            searchPlaceholder={t('models.strategy.searchModel')}
            onValueChange={value => handleRoutingChange('compaction', value)}
          />
          <TaskRoutingRow
            label={t('models.strategy.taskTitle')}
            value={encodeTaskModelSelection(strategy.taskRouting.titleGeneration)}
            catalog={catalog}
            quickOptions={auxiliaryQuickOptions}
            searchPlaceholder={t('models.strategy.searchModel')}
            onValueChange={value => handleRoutingChange('titleGeneration', value)}
          />
        </SettingsSection>
      </div>
    </TooltipProvider>
  )
}
