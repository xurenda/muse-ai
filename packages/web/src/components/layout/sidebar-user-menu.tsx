import { ChevronRight, ChevronUp, Globe, LogOut, Monitor, Moon, Palette, SlidersHorizontal, Sun, User } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LOCALES, type SupportedLocale } from '@museai/shared'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ColorMode } from '@/constants/theme'
import { useAuth } from '@/hooks/use-auth'
import { setAppLocale } from '@/i18n/setup'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/theme'

const MODE_OPTIONS: { value: ColorMode; icon: typeof Sun; labelKey: 'themeLight' | 'themeDark' | 'themeSystem' }[] = [
  { value: 'light', icon: Sun, labelKey: 'themeLight' },
  { value: 'dark', icon: Moon, labelKey: 'themeDark' },
  { value: 'system', icon: Monitor, labelKey: 'themeSystem' },
]

function getUserDisplayName(email: string): string {
  const local = email.split('@')[0]?.trim()
  return local || email
}

export function SidebarUserMenu() {
  const { t } = useTranslation('layout')
  const { t: tc, i18n } = useTranslation('common')
  const { t: ta } = useTranslation('auth')
  const { auth, logout } = useAuth()
  const colorMode = useThemeStore(state => state.colorMode)
  const setColorMode = useThemeStore(state => state.setColorMode)
  const currentLocale = i18n.language.startsWith('zh') ? 'zh' : 'en'
  const displayName = auth?.user.email ? getUserDisplayName(auth.user.email) : tc('appName')

  return (
    <div className="mt-auto px-panel-x pb-panel-x">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={cn('ui-menu-item w-full rounded-control text-sidebar-foreground')}>
            <span className="flex size-6 shrink-0 items-center justify-center text-sidebar-foreground">
              <User className="size-4" strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1 truncate text-left">{displayName}</span>
            <ChevronUp className="size-3.5 shrink-0 opacity-60" strokeWidth={2} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-56">
          <div className="px-menu-x py-menu-y text-sm font-medium">{displayName}</div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/settings">
              <SlidersHorizontal className="size-3.5" strokeWidth={2} />
              {t('sidebar.userMenu.settings')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Globe className="size-3.5" strokeWidth={2} />
              {t('sidebar.userMenu.language')}
              <ChevronRight className="ml-auto size-3.5 opacity-60" strokeWidth={2} />
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={currentLocale} onValueChange={value => setAppLocale(value as SupportedLocale)}>
                {SUPPORTED_LOCALES.map(locale => (
                  <DropdownMenuRadioItem key={locale} value={locale}>
                    {locale === 'zh' ? tc('languageZh') : tc('languageEn')}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Palette className="size-3.5" strokeWidth={2} />
              {t('sidebar.userMenu.appearance')}
              <ChevronRight className="ml-auto size-3.5 opacity-60" strokeWidth={2} />
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={colorMode} onValueChange={value => setColorMode(value as ColorMode)}>
                {MODE_OPTIONS.map(option => {
                  const Icon = option.icon
                  return (
                    <DropdownMenuRadioItem key={option.value} value={option.value}>
                      <Icon className="size-3.5" strokeWidth={2} />
                      {tc(option.labelKey)}
                    </DropdownMenuRadioItem>
                  )
                })}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => logout()}>
            <LogOut className="size-3.5" strokeWidth={2} />
            {ta('logout')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
