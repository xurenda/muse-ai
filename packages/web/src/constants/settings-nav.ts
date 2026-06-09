import { type LucideIcon, Box, Settings2 } from 'lucide-react'

export interface SettingsNavItem {
  to: string
  icon: LucideIcon
  labelKey: string
  end?: boolean
}

export const settingsNavItems = [
  { to: '/settings/general', icon: Settings2, labelKey: 'nav.general', end: true },
  { to: '/settings/models', icon: Box, labelKey: 'nav.models' },
] as const satisfies readonly SettingsNavItem[]
