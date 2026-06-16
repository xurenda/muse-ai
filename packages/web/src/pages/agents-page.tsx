import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { AgentDefinition, Persona, SkillMeta, ToolDescriptor } from '@muse-ai/shared'
import { createAgent, listCliAgents, listPersonas, listSkills, listTools } from '@/api/cli-client'
import { LanguageSwitcher } from '@/components/language-switcher'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/use-auth'

export function AgentsPage() {
  const { t } = useTranslation('agents')
  const { t: tc } = useTranslation('common')
  const { deviceSession } = useAuth()
  const [agents, setAgents] = useState<AgentDefinition[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])
  const [skills, setSkills] = useState<SkillMeta[]>([])
  const [tools, setTools] = useState<ToolDescriptor[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [personaId, setPersonaId] = useState('')
  const [skillIds, setSkillIds] = useState<string[]>([])
  const [activeToolNames, setActiveToolNames] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

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
    setActiveToolNames(prev => (prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]))
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
      <div className="p-8 text-center">
        <Link to="/devices" className="text-primary underline">
          {tc('back')}
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <div className="flex gap-2">
          <LanguageSwitcher />
          <Button variant="outline" size="sm" asChild>
            <Link to="/chat">{tc('back')}</Link>
          </Button>
        </div>
      </header>

      {loading ? <p className="text-muted-foreground">{tc('loading')}</p> : null}

      <form className="mb-8 space-y-4 rounded-lg border border-border bg-card p-6" onSubmit={onSubmit}>
        <h2 className="text-lg font-medium">{t('createTitle')}</h2>
        <div>
          <Label htmlFor="name">{t('name')}</Label>
          <Input id="name" value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="desc">{t('description')}</Label>
          <Input id="desc" value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="persona">{t('persona')}</Label>
          <select
            id="persona"
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={personaId}
            onChange={e => setPersonaId(e.target.value)}
          >
            {personas.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">{t('skills')}</p>
          <p className="mb-2 text-xs text-muted-foreground">{t('selectSkillsHint')}</p>
          <div className="flex flex-wrap gap-2">
            {skills.map(skill => (
              <label key={skill.id} className="flex cursor-pointer items-center gap-2 rounded border border-border px-3 py-2 text-sm">
                <input type="checkbox" checked={skillIds.includes(skill.id)} onChange={() => toggleSkill(skill.id)} />
                {skill.name}
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">{t('tools')}</p>
          <p className="mb-2 text-xs text-muted-foreground">{t('selectToolsHint')}</p>
          <div className="flex flex-wrap gap-2">
            {tools.map(tool => (
              <label key={tool.name} className="flex cursor-pointer items-center gap-2 rounded border border-border px-3 py-2 text-sm">
                <input type="checkbox" checked={activeToolNames.includes(tool.name)} onChange={() => toggleTool(tool.name)} />
                {tool.name}
              </label>
            ))}
          </div>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {success ? <p className="text-sm text-success">{success}</p> : null}
        <Button type="submit">{t('create')}</Button>
      </form>

      <section>
        <h2 className="mb-3 text-lg font-medium">{t('existing')}</h2>
        {agents.length === 0 ? (
          <p className="text-muted-foreground">{t('noAgents')}</p>
        ) : (
          <ul className="space-y-2">
            {agents.map(agent => (
              <li key={agent.id} className="rounded-lg border border-border bg-card p-4">
                <p className="font-medium">{agent.name}</p>
                <p className="text-xs text-muted-foreground">
                  persona={agent.personaId} · skills={agent.skillIds.join(',') || '-'} · tools={agent.activeToolNames.join(',') || '-'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
