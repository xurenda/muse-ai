import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { AgentDefinition, SessionSettingsResponse } from '@muse-ai/shared'
import { listCliAgents } from '@/api/cli-client'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { StoredDeviceSession } from '@/lib/config'

interface ChatSessionBarProps {
  deviceSession: StoredDeviceSession
  sessionSettings: SessionSettingsResponse | null
  disabled: boolean
  compacting: boolean
  onUpdate: (patch: { agentId?: string }) => Promise<boolean>
  onCompact: () => Promise<boolean>
}

function ChatSessionBarFields({ deviceSession, sessionSettings, disabled, compacting, onUpdate, onCompact }: ChatSessionBarProps) {
  const { t } = useTranslation('chat')
  const [agents, setAgents] = useState<AgentDefinition[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void listCliAgents(deviceSession.endpoint, deviceSession.accessToken).then(setAgents)
  }, [deviceSession])

  async function applyAgent(agentId: string) {
    if (!sessionSettings || agentId === sessionSettings.agentId) return
    setSaving(true)
    await onUpdate({ agentId })
    setSaving(false)
  }

  const agentOptions = agents.map(agent => ({ value: agent.id, label: agent.name }))
  const compactDisabled = disabled || compacting || saving

  return (
    <div className="ui-surface-inset flex flex-wrap items-end gap-stack">
      <div className="min-w-[8rem] flex-1">
        <Label className="mb-1 block text-[11px] text-muted-foreground">{t('sessionAgent')}</Label>
        <Select
          value={sessionSettings?.agentId ?? ''}
          options={agentOptions}
          placeholder="—"
          disabled={disabled || saving || compacting}
          onValueChange={value => void applyAgent(value)}
        />
      </div>
      <div className="flex gap-inline-sm pb-0.5">
        <Button type="button" size="sm" variant="outline" disabled={compactDisabled} onClick={() => void onCompact()}>
          {compacting ? t('compactingContext') : t('compactContext')}
        </Button>
        <Button type="button" size="sm" variant="outline" asChild>
          <Link to="/agents">{t('manageAgents')}</Link>
        </Button>
        <Button type="button" size="sm" variant="outline" asChild>
          <Link to="/settings/providers">{t('manageProviders')}</Link>
        </Button>
      </div>
    </div>
  )
}

export function ChatSessionBar(props: ChatSessionBarProps) {
  const settingsKey = props.sessionSettings ? `${props.sessionSettings.sessionId}:${props.sessionSettings.agentId}` : 'empty'

  return <ChatSessionBarFields key={settingsKey} {...props} />
}
