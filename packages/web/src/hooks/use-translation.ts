import { createTranslator, resources, type Namespace, type TranslateFunction } from '@muse-ai/shared/i18n'
import { useMemo } from 'react'
import { useLocaleStore } from '@/stores/locale'

interface UseTranslationResult {
  t: TranslateFunction
  locale: ReturnType<typeof useLocaleStore.getState>['locale']
}

export function useTranslation(namespace: Namespace): UseTranslationResult {
  const locale = useLocaleStore((state) => state.locale)
  const dictionary = resources[locale][namespace]

  const t = useMemo(() => createTranslator(dictionary), [dictionary])

  return { t, locale }
}
