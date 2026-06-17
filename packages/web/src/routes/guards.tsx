import { Navigate, Outlet } from 'react-router-dom'
import { DeviceHealthProvider } from '@/hooks/use-device-health'
import { useAuth } from '@/hooks/use-auth'

export function ProtectedLayout() {
  const { auth } = useAuth()
  if (!auth) {
    return <Navigate to="/login" replace />
  }
  return (
    <DeviceHealthProvider>
      <Outlet />
    </DeviceHealthProvider>
  )
}

export function GuestLayout() {
  const { auth } = useAuth()
  if (auth) {
    return <Navigate to="/chat" replace />
  }
  return <Outlet />
}
