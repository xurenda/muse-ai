import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { thinkingLevelSchema, type AgentDefinition, type SessionSettingsResponse, type ThinkingLevel } from '@muse-ai/shared'
import { listCliAgents } from '@/api/cli-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-border bg-card/50 px-4 py-3">
      <div className="min-w-[10rem] flex-1">
        <Label className="mb-1 block text-xs text-muted-foreground">{t('sessionAgent')}</Label>
        <select
          className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
          value={sessionSettings?.agentId ?? ''}
          disabled={disabled || saving}
          onChange={e => void applyAgent(e.target.value)}
        >
          {agents.map(agent => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-[12rem] flex-[2]">
        <Label className="mb-1 block text-xs text-muted-foreground">{t('sessionModel')}</Label>
        <div className="flex gap-2">
          <Input value={modelRef} onChange={e => setModelRef(e.target.value)} disabled={disabled || saving} />
          <Button type="button" size="sm" variant="outline" disabled={disabled || saving} onClick={() => void applyModel()}>
            OK
          </Button>
        </div>
      </div>
      <div className="min-w-[8rem]">
        <Label className="mb-1 block text-xs text-muted-foreground">{t('sessionThinking')}</Label>
        <select
          className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
          value={thinkingLevel}
          disabled={disabled || saving}
          onChange={e => void applyThinking(e.target.value as ThinkingLevel)}
        >
          {THINKING_LEVELS.map(level => (
            <option key={level} value={level}>
              {t(`thinkingLevels.${level}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2 pb-0.5">
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
