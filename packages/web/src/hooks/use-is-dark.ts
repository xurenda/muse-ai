import { useEffect, useState } from 'react'
import { useThemeStore } from '@/stores/theme'
import { resolveIsDark } from '@/utils/apply-theme'

/** 解析当前是否处于深色模式（含 system 跟随系统） */
export function useIsDark(): boolean {
  const colorMode = useThemeStore((state) => state.colorMode)
  const [isDark, setIsDark] = useState(() => resolveIsDark(colorMode))

  useEffect(() => {
    setIsDark(resolveIsDark(colorMode))

    if (colorMode !== 'system') {
      return
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => setIsDark(resolveIsDark('system'))

    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [colorMode])

  return isDark
}
