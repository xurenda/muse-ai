import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { THEME_STORAGE_KEY, type ColorMode } from '@/constants/theme'
import { applyTheme } from '@/utils/apply-theme'

interface ThemeState {
  colorMode: ColorMode
  setColorMode: (colorMode: ColorMode) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      colorMode: 'system',
      setColorMode: (colorMode) => {
        applyTheme(colorMode)
        set({ colorMode })
      },
    }),
    {
      name: THEME_STORAGE_KEY,
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyTheme(state.colorMode)
        }
      },
    },
  ),
)
