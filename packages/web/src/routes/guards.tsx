import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'

export function ProtectedLayout() {
  const { auth } = useAuth()
  if (!auth) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

export function GuestLayout() {
  const { auth } = useAuth()
  if (auth) {
    return <Navigate to="/devices" replace />
  }
  return <Outlet />
}

export function DeviceRequiredLayout() {
  const { deviceSession } = useAuth()
  if (!deviceSession) {
    return <Navigate to="/devices" replace />
  }
  return <Outlet />
}
