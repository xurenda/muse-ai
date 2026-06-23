import { PanelLeft } from 'lucide-react'
import { IconButton } from '@/components/ui/icon-button'
import { useTranslation } from 'react-i18next'

interface SidebarToggleProps {
  open: boolean
  onToggle: () => void
  className?: string
}

export function SidebarToggle({ open, onToggle, className }: SidebarToggleProps) {
  const { t } = useTranslation('layout')

  return (
    <IconButton
      type="button"
      onClick={onToggle}
      className={className}
      aria-label={open ? t('header.sidebarHide') : t('header.sidebarShow')}
      aria-pressed={open}
      tooltip={open ? t('header.sidebarHide') : t('header.sidebarShow')}
    >
      <PanelLeft className="size-4" strokeWidth={1.75} />
    </IconButton>
  )
}
