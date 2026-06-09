import { type LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/utils/cn'

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
        cn(
          'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
          isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-sidebar-foreground hover:bg-sidebar-accent/60',
        )
      }
    >
      <Icon className="size-4 shrink-0 opacity-70" strokeWidth={1.75} />
      <span>{label}</span>
    </NavLink>
  )
}
