import type { ProviderHealthStatus } from '@muse-ai/shared'
import { cn } from '@/utils/cn'

interface ProviderHealthDotProps {
  status: ProviderHealthStatus
}

const dotClassName: Record<ProviderHealthStatus, string> = {
  missing: 'bg-muted-foreground/40',
  ready: 'bg-emerald-500',
  broken: 'bg-red-500',
}

export function ProviderHealthDot({ status }: ProviderHealthDotProps) {
  return (
    <span
      className={cn('size-2 shrink-0 rounded-full', dotClassName[status])}
      aria-hidden
    />
  )
}
