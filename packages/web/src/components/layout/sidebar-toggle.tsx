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
    <IconButton type="button" onClick={onToggle} className={className} aria-label={t('header.sidebarToggle')} aria-pressed={open}>
      <PanelLeft className="size-4" strokeWidth={1.75} />
    </IconButton>
  )
}
