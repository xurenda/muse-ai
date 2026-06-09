import { NavLink } from 'react-router-dom'
import type { HeaderItem } from '@/constants/app-header'
import { SettingsMenu } from '@/components/layout/settings-menu'
import { useTranslation } from '@/hooks/use-translation'
import { cn } from '@/utils/cn'

interface AppHeaderProps {
  left?: HeaderItem[]
  right?: HeaderItem[]
  onSidebarToggle?: () => void
}

export function AppHeader({ left = [], right = [], onSidebarToggle }: AppHeaderProps) {
  const { t } = useTranslation('layout')

  const renderItem = (item: HeaderItem) => {
    if (item.kind === 'action') {
      const Icon = item.icon
      return (
        <button
          key={item.action}
          type="button"
          onClick={onSidebarToggle}
          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={t(item.labelKey)}
        >
          <Icon className="size-4" strokeWidth={1.75} />
        </button>
      )
    }

    if (item.kind === 'menu') {
      if (item.menu === 'settings') {
        return (
          <SettingsMenu
            key={item.menu}
            labelKey={item.labelKey}
            icon={item.icon}
          />
        )
      }
      return null
    }

    const Icon = item.icon
    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={({ isActive }) =>
          cn(
            'inline-flex size-8 items-center justify-center rounded-md transition-colors',
            isActive
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )
        }
        aria-label={t(item.labelKey)}
      >
        <Icon className="size-4" strokeWidth={1.75} />
      </NavLink>
    )
  }

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/60 px-4">
      <div className="flex items-center gap-1">{left.map(renderItem)}</div>
      <div className="flex items-center gap-1">{right.map(renderItem)}</div>
    </header>
  )
}
