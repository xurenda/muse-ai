import type { ReactNode } from 'react'

interface PageShellProps {
  title?: string
  subtitle?: string
  children: ReactNode
}

export function PageShell({ title, subtitle, children }: PageShellProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-8">
        {title ? (
          <div className="flex flex-col gap-1 px-1">
            <h1 className="text-lg font-semibold">{title}</h1>
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  )
}
