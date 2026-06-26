import zhAgents from './locales/zh/agents.json' with { type: 'json' }
import zhAuth from './locales/zh/auth.json' with { type: 'json' }
import zhChat from './locales/zh/chat.json' with { type: 'json' }
import zhCommon from './locales/zh/common.json' with { type: 'json' }
import zhDevice from './locales/zh/device.json' with { type: 'json' }
import zhLayout from './locales/zh/layout.json' with { type: 'json' }
import zhMarket from './locales/zh/market.json' with { type: 'json' }
import zhSettings from './locales/zh/settings.json' with { type: 'json' }
import enAgents from './locales/en/agents.json' with { type: 'json' }
import enAuth from './locales/en/auth.json' with { type: 'json' }
import enChat from './locales/en/chat.json' with { type: 'json' }
import enCommon from './locales/en/common.json' with { type: 'json' }
import enDevice from './locales/en/device.json' with { type: 'json' }
import enLayout from './locales/en/layout.json' with { type: 'json' }
import enMarket from './locales/en/market.json' with { type: 'json' }
import enSettings from './locales/en/settings.json' with { type: 'json' }

export const SUPPORTED_LOCALES = ['zh', 'en'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: SupportedLocale = 'zh'

export const I18N_NAMESPACES = ['common', 'auth', 'device', 'chat', 'agents', 'settings', 'layout', 'market'] as const
export type I18nNamespace = (typeof I18N_NAMESPACES)[number]

export const i18nResources = {
  zh: {
    common: zhCommon,
    auth: zhAuth,
    device: zhDevice,
    chat: zhChat,
    agents: zhAgents,
    settings: zhSettings,
    layout: zhLayout,
    market: zhMarket,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    device: enDevice,
    chat: enChat,
    agents: enAgents,
    settings: enSettings,
    layout: enLayout,
    market: enMarket,
  },
} as const satisfies Record<SupportedLocale, Record<I18nNamespace, Record<string, unknown>>>
