import { Bot, Server, Settings, SquarePen } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface SidebarItem {
  to: string
  icon: LucideIcon
  labelKey: string
  end?: boolean
}

export const appSidebarItems = [
  { to: '/chat', icon: SquarePen, labelKey: 'sidebar.newChat', end: true },
  { to: '/devices', icon: Server, labelKey: 'sidebar.devices' },
  { to: '/agents', icon: Bot, labelKey: 'sidebar.agents' },
  { to: '/settings', icon: Settings, labelKey: 'sidebar.settings', end: true },
] as const satisfies readonly SidebarItem[]
