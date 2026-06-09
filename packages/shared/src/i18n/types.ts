export const LOCALES = ['zh-CN', 'en'] as const

export type Locale = (typeof LOCALES)[number]

export const NAMESPACES = ['layout', 'settings', 'common'] as const

export type Namespace = (typeof NAMESPACES)[number]

export type TranslationValues = Record<string, string | number>

export type TranslateFunction = (key: string, values?: TranslationValues) => string
