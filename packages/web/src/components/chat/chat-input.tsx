import { FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChatInputMode } from '@/lib/chat-types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const MODES: ChatInputMode[] = ['prompt', 'steer', 'follow_up']

interface ChatInputProps {
  streaming: boolean
  disabled: boolean
  onSend: (text: string, mode: ChatInputMode) => void
}

export function ChatInput({ streaming, disabled, onSend }: ChatInputProps) {
  const { t } = useTranslation('chat')
  const [text, setText] = useState('')
  const [mode, setMode] = useState<ChatInputMode>('prompt')
  const sendMode = streaming && mode === 'prompt' ? 'steer' : mode

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed, sendMode)
    setText('')
  }

  return (
    <form className="border-t border-border bg-card p-4" onSubmit={handleSubmit}>
      <div className="mb-3 flex flex-wrap gap-2">
        {MODES.map(item => {
          const isPromptWhileStreaming = item === 'prompt' && streaming
          const requiresStreaming = item !== 'prompt' && !streaming
          return (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={sendMode === item ? 'default' : 'outline'}
              disabled={disabled || isPromptWhileStreaming || requiresStreaming}
              onClick={() => setMode(item)}
            >
              {t(`mode.${item}`)}
            </Button>
          )
        })}
      </div>
      <div className="flex gap-2">
        <textarea
          className={cn(
            'min-h-[44px] flex-1 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm',
            'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
          rows={2}
          placeholder={streaming ? t('inputPlaceholderSteer') : t('inputPlaceholder')}
          value={text}
          onChange={e => setText(e.target.value)}
          disabled={disabled}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit(e)
            }
          }}
        />
        <Button type="submit" disabled={disabled || !text.trim()} className="self-end">
          {t('send')}
        </Button>
      </div>
      {streaming ? <p className="mt-2 text-xs text-muted-foreground">{t('streamingHint')}</p> : null}
    </form>
  )
}
