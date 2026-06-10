import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface SettingsSectionProps {
  title: string
  children: ReactNode
  className?: string
  action?: ReactNode
  footer?: ReactNode
}

export function SettingsSection({ title, children, className, action, footer }: SettingsSectionProps) {
  return (
    <section className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      <div className="overflow-hidden rounded-xl bg-sidebar">{children}</div>
      {footer}
    </section>
  )
}
