import { ArrowUp, Square } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionSettingsPatch, SessionSettingsResponse } from '@muse-ai/shared'
import { ChatModelPicker } from '@/components/chat/chat-model-picker'
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
  compacting: boolean
  disabled: boolean
  canStop: boolean
  stopping: boolean
  userToken: string | undefined
  sessionSettings: SessionSettingsResponse | null
  onUpdateSessionSettings: (patch: SessionSettingsPatch) => Promise<boolean>
  onSend: (text: string, mode: ChatInputMode) => void
  onStop: () => void
}

export function ChatComposer({
  value,
  onChange,
  streaming,
  compacting,
  disabled,
  canStop,
  stopping,
  userToken,
  sessionSettings,
  onUpdateSessionSettings,
  onSend,
  onStop,
}: ChatComposerProps) {
  const { t } = useTranslation('chat')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isComposingRef = useRef(false)

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

  const handleCompositionStart = () => {
    isComposingRef.current = true
  }

  const handleCompositionEnd = () => {
    // compositionend 可能早于 keydown，延迟复位以免 Enter 确认候选词时误触发发送
    setTimeout(() => {
      isComposingRef.current = false
    }, 0)
  }

  const isImeKeyEvent = (event: React.KeyboardEvent<HTMLTextAreaElement>) => event.nativeEvent.isComposing || isComposingRef.current || event.key === 'Process'

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || isImeKeyEvent(event)) return

    if (!event.shiftKey) {
      event.preventDefault()
      submit(streaming ? 'steer' : 'prompt')
      return
    }

    if (streaming) {
      event.preventDefault()
      submit('follow_up')
    }
  }

  const canSubmit = value.trim().length > 0 && !disabled
  const showStop = streaming || compacting

  return (
    <div className={cn('ui-surface', 'focus-within:border-ring focus-within:ring-1 focus-within:ring-ring')}>
      <Textarea
        ref={textareaRef}
        className="max-h-[200px] min-h-11 resize-none border-0 bg-transparent px-menu-x py-menu-y shadow-none focus-visible:ring-0"
        rows={1}
        placeholder={streaming ? t('input.placeholderStreaming') : compacting ? t('input.placeholderCompacting') : t('input.placeholder')}
        value={value}
        onChange={event => onChange(event.target.value)}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />

      <div className="ui-surface-toolbar">
        <p className="px-1 text-xs text-muted-foreground">
          {streaming ? t('input.hintStreaming') : compacting ? t('input.hintCompacting') : t('input.hintIdle')}
        </p>

        <div className="flex items-center gap-inline-sm">
          <ChatModelPicker userToken={userToken} sessionSettings={sessionSettings} disabled={disabled} onUpdate={onUpdateSessionSettings} />

          {showStop ? (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button type="button" variant="outline" size="icon" disabled={!canStop} onClick={onStop} aria-label={t('input.stop')}>
                    <Square className="size-3.5 fill-current" strokeWidth={0} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">{stopping ? t('input.stopping') : t('input.stop')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}

          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  disabled={!canSubmit}
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
    </div>
  )
}
