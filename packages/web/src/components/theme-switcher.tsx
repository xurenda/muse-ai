import { Monitor, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ColorMode } from '@/constants/theme'
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { IconButton } from '@/components/ui/icon-button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useThemeStore } from '@/stores/theme'

const MODE_OPTIONS: { value: ColorMode; icon: typeof Sun; labelKey: 'themeLight' | 'themeDark' | 'themeSystem' }[] = [
  { value: 'light', icon: Sun, labelKey: 'themeLight' },
  { value: 'dark', icon: Moon, labelKey: 'themeDark' },
  { value: 'system', icon: Monitor, labelKey: 'themeSystem' },
]

export function ThemeSwitcher() {
  const { t } = useTranslation('common')
  const colorMode = useThemeStore(state => state.colorMode)
  const setColorMode = useThemeStore(state => state.setColorMode)
  const systemOption = MODE_OPTIONS[2]
  const activeOption = MODE_OPTIONS.find(option => option.value === colorMode) ?? systemOption
  if (!activeOption) {
    return null
  }
  const ActiveIcon = activeOption.icon

  return (
    <TooltipProvider delayDuration={300}>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <IconButton type="button" aria-label={t('theme')}>
                <ActiveIcon className="size-3.5" strokeWidth={2} />
              </IconButton>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{t('theme')}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup value={colorMode} onValueChange={value => setColorMode(value as ColorMode)}>
            {MODE_OPTIONS.map(option => {
              const Icon = option.icon
              return (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  <Icon className="size-3.5" strokeWidth={2} />
                  {t(option.labelKey)}
                </DropdownMenuRadioItem>
              )
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  )
}
