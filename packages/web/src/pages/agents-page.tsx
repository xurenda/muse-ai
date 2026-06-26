import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { AgentDefinition, PersonaWithSource, SkillWithSource, ToolDescriptor } from '@museai/shared'
import { createAgent, listCliAgents, listPersonas, listSkills, listTools } from '@/api/cli-client'
import { AssetSourceBadge } from '@/components/market/asset-source-badge'
import { PageShell } from '@/components/layout/page-shell'
import { SettingsFieldRow } from '@/components/settings/settings-field-row'
import { SettingsRow } from '@/components/settings/settings-row'
import { SettingsSection } from '@/components/settings/settings-section'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useAuth } from '@/hooks/use-auth'

function formatPersonaLabel(persona: PersonaWithSource, sourceLabel: (source: PersonaWithSource['source']) => string): string {
  return `${persona.name} · ${sourceLabel(persona.source)}`
}

export function AgentsPage() {
  const { t } = useTranslation('agents')
  const { t: tm } = useTranslation('market')
  const { t: tc } = useTranslation('common')
  const { t: tl } = useTranslation('layout')
  const { deviceSession } = useAuth()
  const [agents, setAgents] = useState<AgentDefinition[]>([])
  const [personas, setPersonas] = useState<PersonaWithSource[]>([])
  const [skills, setSkills] = useState<SkillWithSource[]>([])
  const [tools, setTools] = useState<ToolDescriptor[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [personaId, setPersonaId] = useState('')
  const [skillIds, setSkillIds] = useState<string[]>([])
  const [activeToolNames, setActiveToolNames] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const sourceLabel = (source: PersonaWithSource['source']) => (source === 'market' ? tm('source.market') : tm('source.local'))

  useEffect(() => {
    if (!deviceSession) return
    const ds = deviceSession
    void (async () => {
      setLoading(true)
      try {
        const [agentList, personaList, skillList, toolList] = await Promise.all([
          listCliAgents(ds.endpoint, ds.accessToken),
          listPersonas(ds.endpoint, ds.accessToken),
          listSkills(ds.endpoint, ds.accessToken),
          listTools(ds.endpoint, ds.accessToken),
        ])
        setAgents(agentList)
        setPersonas(personaList)
        setSkills(skillList)
        setTools(toolList)
        if (personaList[0]) setPersonaId(personaList[0].id)
      } finally {
        setLoading(false)
      }
    })()
  }, [deviceSession])

  function toggleSkill(id: string) {
    setSkillIds(prev => (prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]))
  }

  function toggleTool(name: string) {
    setActiveToolNames(prev => (prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!deviceSession || !name.trim() || !personaId) return
    setError(null)
    setSuccess(null)
    try {
      await createAgent(deviceSession.endpoint, deviceSession.accessToken, {
        name: name.trim(),
        personaId,
        skillIds,
        activeToolNames,
        description: description.trim() || undefined,
      })
      setAgents(await listCliAgents(deviceSession.endpoint, deviceSession.accessToken))
      setSuccess(t('created'))
      setName('')
      setDescription('')
      setSkillIds([])
      setActiveToolNames([])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('createFailed'))
    }
  }

  if (!deviceSession) {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-muted-foreground">{t('noDevice')}</p>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to="/devices">{tl('sidebar.devices')}</Link>
          </Button>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell title={t('title')}>
      {loading ? <p className="px-1 text-sm text-muted-foreground">{tc('loading')}</p> : null}

      <SettingsSection title={t('createTitle')}>
        <form className="flex flex-col gap-4 px-4 py-3.5" onSubmit={onSubmit}>
          <SettingsFieldRow label={t('name')}>
            <Input value={name} onChange={e => setName(e.target.value)} required />
          </SettingsFieldRow>
          <SettingsFieldRow label={t('description')}>
            <Input value={description} onChange={e => setDescription(e.target.value)} />
          </SettingsFieldRow>
          <SettingsFieldRow label={t('persona')}>
            <Select
              value={personaId}
              onValueChange={setPersonaId}
              options={personas.map(p => ({ value: p.id, label: formatPersonaLabel(p, sourceLabel) }))}
              placeholder={t('persona')}
            />
          </SettingsFieldRow>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">{t('skills')}</p>
            <p className="text-xs text-muted-foreground">{t('selectSkillsHint')}</p>
            <div className="flex flex-wrap gap-2">
              {skills.map(skill => (
                <label
                  key={skill.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-sidebar-border px-3 py-2 text-sm hover:bg-sidebar-accent/30"
                >
                  <input type="checkbox" checked={skillIds.includes(skill.id)} onChange={() => toggleSkill(skill.id)} />
                  <span>{skill.name}</span>
                  <AssetSourceBadge source={skill.source} />
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">{t('tools')}</p>
            <p className="text-xs text-muted-foreground">{t('selectToolsHint')}</p>
            <div className="flex flex-wrap gap-2">
              {tools.map(tool => (
                <label
                  key={tool.name}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-sidebar-border px-3 py-2 text-sm hover:bg-sidebar-accent/30"
                >
                  <input type="checkbox" checked={activeToolNames.includes(tool.name)} onChange={() => toggleTool(tool.name)} />
                  {tool.name}
                </label>
              ))}
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {success ? <p className="text-sm text-success">{success}</p> : null}
          <div className="flex justify-end pt-1">
            <Button type="submit">{t('create')}</Button>
          </div>
        </form>
      </SettingsSection>

      <SettingsSection title={t('existing')}>
        {agents.length === 0 ? (
          <p className="px-4 py-3.5 text-sm text-muted-foreground">{t('noAgents')}</p>
        ) : (
          agents.map(agent => (
            <SettingsRow
              key={agent.id}
              title={agent.name}
              description={`persona=${agent.personaId} · skills=${agent.skillIds.join(',') || '-'} · tools=${agent.activeToolNames.join(',') || '-'}`}
            />
          ))
        )}
      </SettingsSection>
    </PageShell>
  )
}
