import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { registerRequestSchema } from '@museai/shared'
import { BackendApiError, register } from '@/api/backend-client'
import { AuthLayout } from '@/components/layout/auth-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { loginResponseToStored, useAuth } from '@/hooks/use-auth'

export function RegisterPage() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const { setAuth } = useAuth()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const parsed = registerRequestSchema.safeParse({ email, password, username })
    if (!parsed.success) {
      const usernameTaken = parsed.error.issues.some(issue => issue.message === 'username_taken')
      setError(usernameTaken ? t('usernameTaken') : (parsed.error.issues[0]?.message ?? t('registerFailed')))
      return
    }

    setLoading(true)
    try {
      const response = await register(parsed.data)
      setAuth(loginResponseToStored(response))
      navigate('/chat')
    } catch (err: unknown) {
      if (err instanceof BackendApiError && err.code === 'username_taken') {
        setError(t('usernameTaken'))
      } else {
        setError(err instanceof Error ? err.message : t('registerFailed'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title={t('registerTitle')}
      footer={
        <>
          {t('hasAccount')}{' '}
          <Link className="text-primary hover:underline" to="/login">
            {t('goLogin')}
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email">{t('email')}</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="username">{t('username')}</Label>
          <Input
            id="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={32}
            pattern="[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">{t('usernameHint')}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{t('password')}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? '…' : t('registerSubmit')}
        </Button>
      </form>
    </AuthLayout>
  )
}
