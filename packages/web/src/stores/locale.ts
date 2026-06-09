import type { Locale } from '@muse-ai/shared/i18n'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { LOCALE_STORAGE_KEY } from '@/constants/locale'

interface LocaleState {
  locale: Locale
  setLocale: (locale: Locale) => void
}

function applyLocale(locale: Locale): void {
  document.documentElement.lang = locale
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: 'zh-CN',
      setLocale: (locale) => {
        applyLocale(locale)
        set({ locale })
      },
    }),
    {
      name: LOCALE_STORAGE_KEY,
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyLocale(state.locale)
        }
      },
    },
  ),
)
