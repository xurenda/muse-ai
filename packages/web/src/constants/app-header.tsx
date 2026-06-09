import { type LucideIcon, PanelLeft, Settings } from 'lucide-react'

export interface HeaderActionItem {
  kind: 'action'
  action: 'sidebar-toggle'
  icon: LucideIcon
  labelKey: string
}

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

export type HeaderItem = HeaderActionItem | HeaderNavItem | HeaderMenuItem

export const appHeaderLeftItems = [
  { kind: 'action', action: 'sidebar-toggle', icon: PanelLeft, labelKey: 'header.sidebarToggle' },
] as const satisfies readonly HeaderItem[]

export const appHeaderRightItems = [
  { kind: 'menu', menu: 'settings', icon: Settings, labelKey: 'header.settings' },
] as const satisfies readonly HeaderItem[]
