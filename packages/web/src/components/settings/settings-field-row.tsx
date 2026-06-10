import type { ReactNode } from 'react'

interface SettingsFieldRowProps {
  label: string
  children: ReactNode
}

/** 设置项：左侧标签、右侧控件 */
export function SettingsFieldRow({ label, children }: SettingsFieldRowProps) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
