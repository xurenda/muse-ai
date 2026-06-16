import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BackendApiError, login } from '@/api/backend-client'
import { LanguageSwitcher } from '@/components/language-switcher'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { loginResponseToStored, useAuth } from '@/hooks/use-auth'

export function LoginPage() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const { setAuth } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const response = await login({ email, password })
      setAuth(loginResponseToStored(response))
      navigate('/devices')
    } catch (err: unknown) {
      if (err instanceof BackendApiError && err.code === 'invalid_credentials') {
        setError(t('invalidCredentials'))
      } else {
        setError(err instanceof Error ? err.message : t('loginFailed'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div className="flex justify-end">
        <LanguageSwitcher />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{t('loginTitle')}</h1>
      </div>
      <form className="space-y-4 rounded-lg border border-border bg-card p-6" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email">{t('email')}</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{t('password')}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? '…' : t('loginSubmit')}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {t('noAccount')}{' '}
        <Link className="text-primary hover:underline" to="/register">
          {t('goRegister')}
        </Link>
      </p>
    </div>
  )
}
