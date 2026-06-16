import { useSyncExternalStore } from 'react'
import { useThemeStore } from '@/stores/theme'

function subscribeSystemColorScheme(onChange: () => void): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function getSystemIsDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** 解析当前是否处于深色模式（含 system 跟随系统） */
export function useIsDark(): boolean {
  const colorMode = useThemeStore(state => state.colorMode)
  const systemIsDark = useSyncExternalStore(subscribeSystemColorScheme, getSystemIsDark, () => false)

  if (colorMode === 'dark') return true
  if (colorMode === 'light') return false
  return systemIsDark
}
