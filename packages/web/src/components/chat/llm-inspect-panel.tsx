import { useTranslation } from 'react-i18next'
import { JsonTreeView } from '@/components/chat/json-tree-view'
import { useSessionLlmInspect } from '@/hooks/use-session-llm-inspect'

interface LlmInspectPanelProps {
  endpoint: string
  accessToken: string
  sessionId: string
  isStreaming: boolean
  enabled: boolean
}

export function LlmInspectPanel({ endpoint, accessToken, sessionId, isStreaming, enabled }: LlmInspectPanelProps) {
  const { t } = useTranslation('chat')
  const { inspect, isLoading, error } = useSessionLlmInspect({
    endpoint,
    accessToken,
    sessionId,
    enabled,
    isStreaming,
  })

  const hasInspect = inspect?.request !== undefined || inspect?.response !== undefined

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {error ? <p className="px-3 py-2 text-xs text-destructive">{error}</p> : null}

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-2">
        {isLoading ? <p className="px-1 text-xs text-muted-foreground">{t('llmInspect.loading')}</p> : null}

        {!isLoading && !hasInspect ? <p className="px-1 text-xs text-muted-foreground">{t('llmInspect.empty')}</p> : null}

        {inspect?.request !== undefined ? (
          <section>
            <h3 className="px-3 pb-1 text-[11px] font-medium text-muted-foreground">{t('llmInspect.requestTitle')}</h3>
            <JsonTreeView value={inspect.request} collapsed={2} />
          </section>
        ) : null}

        {inspect?.response !== undefined ? (
          <section>
            <h3 className="px-3 pb-1 text-[11px] font-medium text-muted-foreground">{t('llmInspect.responseTitle')}</h3>
            <JsonTreeView value={inspect.response} collapsed={2} />
          </section>
        ) : null}
      </div>
    </div>
  )
}
