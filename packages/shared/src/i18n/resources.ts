import enCommon from './locales/en/common.json'
import enLayout from './locales/en/layout.json'
import enSettings from './locales/en/settings.json'
import zhCNCommon from './locales/zh-CN/common.json'
import zhCNLayout from './locales/zh-CN/layout.json'
import zhCNSettings from './locales/zh-CN/settings.json'
import type { Locale, Namespace } from './types'

export const resources: Record<Locale, Record<Namespace, Record<string, unknown>>> = {
  'zh-CN': {
    layout: zhCNLayout,
    settings: zhCNSettings,
    common: zhCNCommon,
  },
  en: {
    layout: enLayout,
    settings: enSettings,
    common: enCommon,
  },
}
