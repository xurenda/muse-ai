import { type ReactNode, useEffect } from 'react'
import { useThemeStore } from '@/stores/theme'
import { applyTheme } from '@/utils/apply-theme'

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const colorMode = useThemeStore(state => state.colorMode)

  useEffect(() => {
    applyTheme(colorMode)
  }, [colorMode])

  useEffect(() => {
    if (colorMode !== 'system') {
      return
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => applyTheme('system')

    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [colorMode])

  return children
}
