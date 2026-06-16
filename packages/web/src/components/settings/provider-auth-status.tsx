import { ProviderHealthDot } from '@/components/settings/provider-health-dot'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface ProviderAuthStatusProps {
  configured: boolean
  label: string
  tooltip?: string
}

/** 供应方配置状态：圆点 + 文字，共用同一 tooltip */
export function ProviderAuthStatus({ configured, label, tooltip }: ProviderAuthStatusProps) {
  const content = (
    <span className="inline-flex items-center gap-2">
      <ProviderHealthDot status={configured ? 'ready' : 'missing'} />
      <span className={cn('text-sm font-medium', configured ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>{label}</span>
    </span>
  )

  if (!tooltip) {
    return content
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{content}</span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}
