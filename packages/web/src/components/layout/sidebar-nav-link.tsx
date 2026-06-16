import type { LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface SidebarNavLinkProps {
  to: string
  icon: LucideIcon
  label: string
  end?: boolean
}

export function SidebarNavLink({ to, icon: Icon, label, end }: SidebarNavLinkProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn('ui-menu-item rounded-control', isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/60')
      }
    >
      <Icon className="size-3.5 shrink-0 opacity-80" strokeWidth={2} />
      <span>{label}</span>
    </NavLink>
  )
}
