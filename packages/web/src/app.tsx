import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/hooks/use-auth'
import { AgentsPage } from '@/pages/agents-page'
import { ChatPage } from '@/pages/chat-page'
import { DevicesPage } from '@/pages/devices-page'
import { LoginPage } from '@/pages/login-page'
import { ProvidersPage } from '@/pages/providers-page'
import { RegisterPage } from '@/pages/register-page'
import { DeviceRequiredLayout, GuestLayout, ProtectedLayout } from '@/routes/guards'

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<GuestLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route element={<ProtectedLayout />}>
          <Route path="/devices" element={<DevicesPage />} />
          <Route path="/settings/providers" element={<ProvidersPage />} />
          <Route element={<DeviceRequiredLayout />}>
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/agents" element={<AgentsPage />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/devices" replace />} />
        <Route path="*" element={<Navigate to="/devices" replace />} />
      </Routes>
    </AuthProvider>
  )
}
