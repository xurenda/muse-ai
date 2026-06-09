import type { ColorMode } from '@/constants/theme'

/** 根据 colorMode 解析当前是否应使用深色 */
export function resolveIsDark(colorMode: ColorMode): boolean {
  if (colorMode === 'dark') {
    return true
  }
  if (colorMode === 'light') {
    return false
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** 将主题同步到 document.documentElement */
export function applyTheme(colorMode: ColorMode): void {
  const isDark = resolveIsDark(colorMode)
  const root = document.documentElement

  root.classList.toggle('dark', isDark)
  root.style.colorScheme = isDark ? 'dark' : 'light'
}
