import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SettingsSectionProps {
  title: string
  children: ReactNode
  className?: string
  /** 紧挨标题右侧的提示（如图标 + tooltip） */
  titleHint?: ReactNode
  action?: ReactNode
  footer?: ReactNode
}

export function SettingsSection({ title, children, className, titleHint, action, footer }: SettingsSectionProps) {
  return (
    <section className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {titleHint}
        </div>
        {action}
      </div>
      <div className="overflow-hidden rounded-xl bg-sidebar">{children}</div>
      {footer}
    </section>
  )
}
