import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { thinkingLevelSchema, type AgentDefinition, type SessionSettingsResponse, type ThinkingLevel } from '@muse-ai/shared'
import { listCliAgents } from '@/api/cli-client'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { StoredDeviceSession } from '@/lib/config'

const THINKING_LEVELS = thinkingLevelSchema.options

interface ChatSessionBarProps {
  deviceSession: StoredDeviceSession
  sessionSettings: SessionSettingsResponse | null
  disabled: boolean
  onUpdate: (patch: { agentId?: string; modelRef?: string; thinkingLevel?: ThinkingLevel }) => Promise<boolean>
}

function ChatSessionBarFields({ deviceSession, sessionSettings, disabled, onUpdate }: ChatSessionBarProps) {
  const { t } = useTranslation('chat')
  const [agents, setAgents] = useState<AgentDefinition[]>([])
  const [modelRef, setModelRef] = useState(sessionSettings?.modelRef ?? '')
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>(sessionSettings?.thinkingLevel ?? 'off')
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

  async function applyModel() {
    if (!sessionSettings || modelRef === sessionSettings.modelRef) return
    setSaving(true)
    await onUpdate({ modelRef })
    setSaving(false)
  }

  async function applyThinking(level: ThinkingLevel) {
    setThinkingLevel(level)
    if (!sessionSettings || level === sessionSettings.thinkingLevel) return
    setSaving(true)
    await onUpdate({ thinkingLevel: level })
    setSaving(false)
  }

  const agentOptions = agents.map(agent => ({ value: agent.id, label: agent.name }))
  const thinkingOptions = THINKING_LEVELS.map(level => ({
    value: level,
    label: t(`thinkingLevels.${level}`),
  }))

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
      <div className="min-w-[8rem] flex-1">
        <Label className="mb-1 block text-[11px] text-muted-foreground">{t('sessionAgent')}</Label>
        <Select
          value={sessionSettings?.agentId ?? ''}
          options={agentOptions}
          placeholder="—"
          disabled={disabled || saving}
          onValueChange={value => void applyAgent(value)}
        />
      </div>
      <div className="min-w-[10rem] flex-[2]">
        <Label className="mb-1 block text-[11px] text-muted-foreground">{t('sessionModel')}</Label>
        <div className="flex gap-1.5">
          <Input value={modelRef} onChange={e => setModelRef(e.target.value)} disabled={disabled || saving} className="h-8" />
          <Button type="button" size="sm" variant="outline" disabled={disabled || saving} onClick={() => void applyModel()}>
            OK
          </Button>
        </div>
      </div>
      <div className="min-w-[7rem] flex-1">
        <Label className="mb-1 block text-[11px] text-muted-foreground">{t('sessionThinking')}</Label>
        <Select
          value={thinkingLevel}
          options={thinkingOptions}
          disabled={disabled || saving}
          onValueChange={value => void applyThinking(value as ThinkingLevel)}
        />
      </div>
      <div className="flex gap-1.5 pb-0.5">
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
  const settingsKey = props.sessionSettings
    ? `${props.sessionSettings.sessionId}:${props.sessionSettings.agentId}:${props.sessionSettings.modelRef}:${props.sessionSettings.thinkingLevel}`
    : 'empty'

  return <ChatSessionBarFields key={settingsKey} {...props} />
}
