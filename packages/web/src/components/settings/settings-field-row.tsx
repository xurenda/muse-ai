import type { ReactNode } from 'react'

interface SettingsFieldRowProps {
  label: string
  children: ReactNode
  className?: string
}

/** 设置项：左侧标签、右侧控件 */
export function SettingsFieldRow({ label, children, className }: SettingsFieldRowProps) {
  return (
    <div className={className ?? 'flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:gap-3'}>
      <span className="shrink-0 text-muted-foreground sm:w-32">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
