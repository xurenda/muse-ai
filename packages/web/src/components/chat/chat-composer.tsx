import { ArrowUp } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { ChatInputMode } from '@/lib/chat-types'
import { cn } from '@/lib/utils'

const TEXTAREA_MAX_HEIGHT = 200

interface ChatComposerProps {
  value: string
  onChange: (value: string) => void
  streaming: boolean
  disabled: boolean
  onSend: (text: string, mode: ChatInputMode) => void
}

export function ChatComposer({ value, onChange, streaming, disabled, onSend }: ChatComposerProps) {
  const { t } = useTranslation('chat')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, TEXTAREA_MAX_HEIGHT)}px`
  }, [value])

  const submit = useCallback(
    (mode: ChatInputMode) => {
      const trimmed = value.trim()
      if (!trimmed || disabled) return
      if (!streaming && mode !== 'prompt') return
      if (streaming && mode === 'prompt') return
      onSend(trimmed, mode)
      onChange('')
    },
    [disabled, onChange, onSend, streaming, value],
  )

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit(streaming ? 'steer' : 'prompt')
      return
    }

    if (event.key === 'Enter' && event.shiftKey && streaming) {
      event.preventDefault()
      submit('follow_up')
    }
  }

  const canSend = value.trim().length > 0 && !disabled

  return (
    <div
      className={cn(
        'rounded-xl border border-border/60 bg-background shadow-sm transition-colors',
        'focus-within:border-ring focus-within:ring-1 focus-within:ring-ring',
      )}
    >
      <Textarea
        ref={textareaRef}
        className="max-h-[200px] min-h-11 resize-none border-0 bg-transparent px-3 py-2.5 shadow-none focus-visible:ring-0"
        rows={1}
        placeholder={streaming ? t('input.placeholderStreaming') : t('input.placeholder')}
        value={value}
        onChange={event => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />

      <div className="flex items-center justify-between gap-2 px-2 pb-2">
        <p className="px-1 text-xs text-muted-foreground">{streaming ? t('input.hintStreaming') : t('input.hintIdle')}</p>

        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                disabled={!canSend}
                onClick={() => submit(streaming ? 'steer' : 'prompt')}
                aria-label={streaming ? t('input.steer') : t('input.send')}
              >
                <ArrowUp className="size-4" strokeWidth={2} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{streaming ? t('input.steer') : t('input.send')}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )
}
