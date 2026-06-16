import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { useThemeStore } from '@/stores/theme'

export function Toaster(props: ToasterProps) {
  const colorMode = useThemeStore(state => state.colorMode)
  const theme = colorMode === 'system' ? 'system' : colorMode

  return (
    <Sonner
      theme={theme}
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: '!gap-2 !px-2.5 !py-2',
          title: 'text-sm',
          description: 'text-xs',
        },
      }}
      {...props}
    />
  )
}
