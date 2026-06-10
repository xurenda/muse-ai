import enChat from './locales/en/chat.json'
import enCommon from './locales/en/common.json'
import enDaemon from './locales/en/daemon.json'
import enLayout from './locales/en/layout.json'
import enSettings from './locales/en/settings.json'
import zhCNChat from './locales/zh-CN/chat.json'
import zhCNCommon from './locales/zh-CN/common.json'
import zhCNDaemon from './locales/zh-CN/daemon.json'
import zhCNLayout from './locales/zh-CN/layout.json'
import zhCNSettings from './locales/zh-CN/settings.json'
import type { Locale, Namespace } from './types'

export const resources: Record<Locale, Record<Namespace, Record<string, unknown>>> = {
  'zh-CN': {
    layout: zhCNLayout,
    settings: zhCNSettings,
    common: zhCNCommon,
    daemon: zhCNDaemon,
    chat: zhCNChat,
  },
  en: {
    layout: enLayout,
    settings: enSettings,
    common: enCommon,
    daemon: enDaemon,
    chat: enChat,
  },
}
