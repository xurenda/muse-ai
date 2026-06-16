import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/hooks/use-auth'
import { AppLayout } from '@/layouts/app-layout'
import { SettingsLayout } from '@/layouts/settings-layout'
import { AgentsPage } from '@/pages/agents-page'
import { ChatPage } from '@/pages/chat-page'
import { DevicesPage } from '@/pages/devices-page'
import { LoginPage } from '@/pages/login-page'
import { RegisterPage } from '@/pages/register-page'
import { GeneralSettingsPage } from '@/pages/settings/general-settings-page'
import { ProvidersSettingsPage } from '@/pages/settings/providers-settings-page'
import { GuestLayout, ProtectedLayout } from '@/routes/guards'

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<GuestLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route element={<ProtectedLayout />}>
          <Route element={<AppLayout />}>
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/chat/:sessionId" element={<ChatPage />} />
            <Route path="/devices" element={<DevicesPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/settings" element={<SettingsLayout />}>
              <Route index element={<Navigate to="general" replace />} />
              <Route path="general" element={<GeneralSettingsPage />} />
              <Route path="providers" element={<ProvidersSettingsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </AuthProvider>
  )
}
