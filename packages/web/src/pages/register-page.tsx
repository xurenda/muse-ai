import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { register } from '@/api/backend-client'
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
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const response = await register({ email, password })
      setAuth(loginResponseToStored(response))
      navigate('/chat')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('registerFailed'))
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
