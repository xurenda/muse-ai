import { PanelRight } from 'lucide-react'
import { IconButton } from '@/components/ui/icon-button'
import { useTranslation } from 'react-i18next'

interface SessionTreeToggleProps {
  open: boolean
  onToggle: () => void
  className?: string
}

export function SessionTreeToggle({ open, onToggle, className }: SessionTreeToggleProps) {
  const { t } = useTranslation('layout')

  return (
    <IconButton type="button" onClick={onToggle} className={className} aria-label={t('header.sessionTreeToggle')} aria-pressed={open}>
      <PanelRight className="size-4" strokeWidth={1.75} />
    </IconButton>
  )
}
