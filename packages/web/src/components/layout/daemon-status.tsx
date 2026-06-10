import { useTranslation } from '@/hooks/use-translation'
import { useDaemonStatus } from '@/hooks/use-daemon-status'
import { cn } from '@/utils/cn'

export function DaemonStatus() {
  const { t } = useTranslation('daemon')
  const { online } = useDaemonStatus()

  const isOnline = online === true
  const isChecking = online === null

  return (
    <div
      className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-muted-foreground"
      title={isOnline ? t('status.online') : t('status.offlineHint')}
    >
      <span
        aria-hidden
        className={cn(
          'size-2 shrink-0 rounded-full',
          isChecking && 'bg-muted-foreground/40',
          !isChecking && isOnline && 'bg-emerald-500',
          !isChecking && !isOnline && 'bg-destructive',
        )}
      />
      <span>{isChecking ? '…' : isOnline ? t('status.online') : t('status.offline')}</span>
    </div>
  )
}
