import { DEFAULT_PORTS } from '@muse-ai/shared'

export const backendBaseUrl = import.meta.env.VITE_BACKEND_URL ?? `http://127.0.0.1:${DEFAULT_PORTS.SERVER}`

export const AUTH_STORAGE_KEY = 'muse.auth'

export interface StoredAuth {
  accessToken: string
  user: { id: string; email: string }
}

export const DEVICE_SESSION_KEY = 'muse.deviceSession'

export interface StoredDeviceSession {
  deviceId: string
  deviceName: string
  endpoint: string
  accessToken: string
}

export const LOCALE_STORAGE_KEY = 'muse.locale'
