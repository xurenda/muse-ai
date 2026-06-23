import { Maximize2, Minimize2, PanelRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { IconButton } from '@/components/ui/icon-button'

interface RightPanelToolbarProps {
  fullscreen: boolean
  onToggleFullscreen: () => void
  onCollapse: () => void
}

export function RightPanelToolbar({ fullscreen, onToggleFullscreen, onCollapse }: RightPanelToolbarProps) {
  const { t } = useTranslation('layout')

  return (
    <div className="flex items-center gap-0.5">
      <IconButton
        type="button"
        onClick={onToggleFullscreen}
        aria-label={fullscreen ? t('header.rightPanelExitFullscreen') : t('header.rightPanelFullscreen')}
        aria-pressed={fullscreen}
        tooltip={fullscreen ? t('header.rightPanelExitFullscreen') : t('header.rightPanelFullscreen')}
      >
        {fullscreen ? <Minimize2 className="size-4" strokeWidth={1.75} /> : <Maximize2 className="size-4" strokeWidth={1.75} />}
      </IconButton>
      <IconButton type="button" onClick={onCollapse} aria-label={t('header.rightPanelHide')} aria-pressed tooltip={t('header.rightPanelHide')}>
        <PanelRight className="size-4" strokeWidth={1.75} />
      </IconButton>
    </div>
  )
}
