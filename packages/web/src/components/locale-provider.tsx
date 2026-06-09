import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { useLocaleStore } from '@/stores/locale'

interface LocaleProviderProps {
  children: ReactNode
}

export function LocaleProvider({ children }: LocaleProviderProps) {
  const locale = useLocaleStore((state) => state.locale)

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return children
}
