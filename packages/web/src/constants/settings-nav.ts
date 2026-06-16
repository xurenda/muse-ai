import { Brain, Plug, Settings2, type LucideIcon } from 'lucide-react'

export interface SettingsNavItem {
  to: string
  icon: LucideIcon
  labelKey: string
  end?: boolean
}

export const settingsNavItems = [
  { to: '/settings/general', icon: Settings2, labelKey: 'nav.general', end: true },
  { to: '/settings/models', icon: Brain, labelKey: 'nav.models' },
  { to: '/settings/providers', icon: Plug, labelKey: 'nav.providers' },
] as const satisfies readonly SettingsNavItem[]
