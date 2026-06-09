import { Settings, type LucideIcon } from 'lucide-react'

export interface HeaderNavItem {
  kind: 'nav'
  to: string
  icon: LucideIcon
  labelKey: string
}

export interface HeaderMenuItem {
  kind: 'menu'
  menu: 'settings'
  icon: LucideIcon
  labelKey: string
}

export type HeaderItem = HeaderNavItem | HeaderMenuItem

export const appHeaderRightItems = [
  { kind: 'menu', menu: 'settings', icon: Settings, labelKey: 'header.settings' },
] as const satisfies readonly HeaderItem[]
