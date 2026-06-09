import { type LucideIcon, Bot, SquarePen } from 'lucide-react'

export interface SidebarItem {
  to: string
  icon: LucideIcon
  labelKey: string
  end?: boolean
}

export const appSidebarItems = [
  { to: '/new-chat', icon: SquarePen, labelKey: 'sidebar.newChat', end: true },
  { to: '/skills', icon: Bot, labelKey: 'sidebar.skills' },
] as const satisfies readonly SidebarItem[]
