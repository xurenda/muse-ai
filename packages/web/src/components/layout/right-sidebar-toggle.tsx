import { PanelRight } from 'lucide-react'
import { IconButton } from '@/components/ui/icon-button'
import { useTranslation } from '@/hooks/use-translation'
import { cn } from '@/utils/cn'

interface RightSidebarToggleProps {
  open: boolean
  onToggle: () => void
  className?: string
}

export function RightSidebarToggle({ open, onToggle, className }: RightSidebarToggleProps) {
  const { t } = useTranslation('layout')

  return (
    <IconButton
      type="button"
      onClick={onToggle}
      className={cn(className)}
      aria-label={t('header.rightSidebarToggle')}
      aria-pressed={open}
    >
      <PanelRight className="size-4" strokeWidth={1.75} />
    </IconButton>
  )
}
