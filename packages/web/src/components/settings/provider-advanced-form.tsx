import type { ProviderAdvancedConfig, ProviderExtraModelEntry } from '@muse-ai/shared'
import { ChevronRight, Plus, Trash2 } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { HeadersEditor } from '@/components/settings/headers-editor'
import { SettingsFieldRow } from '@/components/settings/settings-field-row'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { useTranslation } from '@/hooks/use-translation'
import { cn } from '@/utils/cn'

const emptyExtraModel = (): ProviderExtraModelEntry => ({
  id: '',
  name: '',
  headers: [],
})

interface ProviderAdvancedFormProps {
  value: ProviderAdvancedConfig
  onChange: (value: ProviderAdvancedConfig) => void
  actions?: ReactNode
}

export function ProviderAdvancedForm({ value, onChange, actions }: ProviderAdvancedFormProps) {
  const { t } = useTranslation('settings')
  const [expanded, setExpanded] = useState(false)
  const extraModels = value.extraModels.length > 0 ? value.extraModels : [emptyExtraModel()]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Button type="button" size="sm" variant="outline" onClick={() => setExpanded((current) => !current)}>
          {t('providers.advanced.title')}
          <ChevronRight
            className={cn('size-3.5 transition-transform', expanded && 'rotate-90')}
            strokeWidth={2}
          />
        </Button>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>

      {expanded ? (
        <div className="flex flex-col gap-4">
          <SettingsFieldRow label={t('providers.advanced.baseUrl')}>
            <Input
              placeholder={t('providers.advanced.baseUrlPlaceholder')}
              value={value.baseUrl ?? ''}
              onChange={(event) => onChange({ ...value, baseUrl: event.target.value })}
            />
          </SettingsFieldRow>

          <HeadersEditor
            label={t('providers.advanced.headers')}
            headers={value.headers}
            keyPlaceholder={t('providers.advanced.headerKey')}
            valuePlaceholder={t('providers.advanced.headerValue')}
            addLabel={t('providers.advanced.addHeader')}
            onChange={(headers) => onChange({ ...value, headers })}
          />

          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted-foreground">{t('providers.advanced.extraModels')}</span>
            {extraModels.map((model, index) => (
              <div key={index} className="flex flex-col gap-2 rounded-lg border border-border/70 p-3">
                <div className="flex items-center gap-2">
                  <Input
                    className="min-w-0 flex-1"
                    placeholder={t('providers.custom.modelId')}
                    value={model.id}
                    onChange={(event) =>
                      onChange({
                        ...value,
                        extraModels: extraModels.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, id: event.target.value } : item,
                        ),
                      })
                    }
                  />
                  <Input
                    className="min-w-0 flex-1"
                    placeholder={t('providers.custom.modelName')}
                    value={model.name}
                    onChange={(event) =>
                      onChange({
                        ...value,
                        extraModels: extraModels.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, name: event.target.value } : item,
                        ),
                      })
                    }
                  />
                  <IconButton
                    type="button"
                    disabled={extraModels.length <= 1}
                    onClick={() =>
                      onChange({
                        ...value,
                        extraModels: extraModels.filter((_, itemIndex) => itemIndex !== index),
                      })
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
                  onChange={(headers) =>
                    onChange({
                      ...value,
                      extraModels: extraModels.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, headers } : item,
                      ),
                    })
                  }
                />
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-fit"
              onClick={() => onChange({ ...value, extraModels: [...extraModels, emptyExtraModel()] })}
            >
              <Plus className="size-3.5" strokeWidth={2} />
              {t('providers.advanced.addModel')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export const emptyProviderAdvanced = (): ProviderAdvancedConfig => ({
  baseUrl: '',
  headers: [],
  extraModels: [],
})
