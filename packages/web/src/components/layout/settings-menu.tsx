import type { Locale } from '@muse-ai/shared/i18n'
import {
  ChevronDown,
  ChevronRight,
  Languages,
  Monitor,
  Moon,
  Palette,
  SlidersHorizontal,
  Sun,
  type LucideIcon,
} from 'lucide-react'
import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ColorMode } from '@/constants/theme'
import { useTranslation } from '@/hooks/use-translation'
import { useLocaleStore } from '@/stores/locale'
import { useThemeStore } from '@/stores/theme'
import { cn } from '@/utils/cn'

interface SettingsMenuProps {
  labelKey: string
  icon: LucideIcon
}

interface RadioOption {
  value: string
  label: string
  icon?: LucideIcon
}

function SubmenuOptions({
  options,
  value,
  defaultValue,
  onValueChange,
}: {
  options: RadioOption[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
}) {
  return (
    <DropdownMenuRadioGroup value={value} defaultValue={defaultValue} onValueChange={onValueChange}>
      {options.map((option) => {
        const Icon = option.icon
        return (
          <DropdownMenuRadioItem key={option.value} value={option.value}>
            {Icon ? <Icon className="size-4" strokeWidth={1.75} /> : null}
            {option.label}
          </DropdownMenuRadioItem>
        )
      })}
    </DropdownMenuRadioGroup>
  )
}

function SubmenuTrigger({
  icon: Icon,
  label,
  chevron,
}: {
  icon: LucideIcon
  label: string
  chevron: ReactNode
}) {
  return (
    <>
      <Icon className="size-4" strokeWidth={1.75} />
      {label}
      <span className="ml-auto">{chevron}</span>
    </>
  )
}

export function SettingsMenu({ labelKey, icon: TriggerIcon }: SettingsMenuProps) {
  const { t: tLayout } = useTranslation('layout')
  const { t } = useTranslation('settings')
  const locale = useLocaleStore((state) => state.locale)
  const setLocale = useLocaleStore((state) => state.setLocale)
  const colorMode = useThemeStore((state) => state.colorMode)
  const setColorMode = useThemeStore((state) => state.setColorMode)

  const languageOptions: RadioOption[] = [
    { value: 'zh-CN', label: t('languageOptions.zh-CN') },
    { value: 'en', label: t('languageOptions.en') },
  ]

  const appearanceOptions: RadioOption[] = [
    { value: 'light', icon: Sun, label: t('appearanceOptions.light') },
    { value: 'dark', icon: Moon, label: t('appearanceOptions.dark') },
    { value: 'system', icon: Monitor, label: t('appearanceOptions.system') },
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors',
            'hover:bg-accent hover:text-foreground',
            'data-[state=open]:bg-accent data-[state=open]:text-foreground',
          )}
          aria-label={tLayout(labelKey)}
        >
          <TriggerIcon className="size-4" strokeWidth={1.75} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem asChild>
          <Link
            to="/setting"
            className="flex w-full items-center gap-2"
          >
            <SlidersHorizontal className="size-4" strokeWidth={1.75} />
            {t('systemSettings')}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <SubmenuTrigger
              icon={Languages}
              label={t('language')}
              chevron={<ChevronRight className="size-3.5 text-muted-foreground" strokeWidth={1.75} />}
            />
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-36">
            <SubmenuOptions
              options={languageOptions}
              value={locale}
              onValueChange={(value) => setLocale(value as Locale)}
            />
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <SubmenuTrigger
              icon={Palette}
              label={t('appearance')}
              chevron={<ChevronDown className="size-3.5 text-muted-foreground" strokeWidth={1.75} />}
            />
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-36">
            <SubmenuOptions
              options={appearanceOptions}
              value={colorMode}
              onValueChange={(value) => setColorMode(value as ColorMode)}
            />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
