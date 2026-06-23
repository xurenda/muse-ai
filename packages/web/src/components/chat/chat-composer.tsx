import { ArrowUp, Check, ChevronRight, Plus, Square } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listCliAgents } from '@/api/cli-client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { StoredDeviceSession } from '@/lib/config'
import type { ChatInputMode } from '@/lib/chat-types'
import { cn } from '@/lib/utils'
import type { AgentDefinition, SessionSettingsResponse } from '@muse-ai/shared'

const TEXTAREA_MAX_HEIGHT = 200

interface ChatComposerProps {
  value: string
  onChange: (value: string) => void
  streaming: boolean
  compacting: boolean
  disabled: boolean
  canStop: boolean
  stopping: boolean
  deviceSession: StoredDeviceSession
  sessionSettings: SessionSettingsResponse | null
  onUpdateSession: (patch: { agentId?: string }) => Promise<boolean>
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
  deviceSession,
  sessionSettings,
  onUpdateSession,
  onSend,
  onStop,
}: ChatComposerProps) {
  const { t } = useTranslation('chat')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isComposingRef = useRef(false)
  const [agents, setAgents] = useState<AgentDefinition[]>([])
  const [plusOpen, setPlusOpen] = useState(false)
  const [agentSubOpen, setAgentSubOpen] = useState(false)
  const plusRef = useRef<HTMLDivElement>(null)

  // 加载 Agent 列表
  useEffect(() => {
    void listCliAgents(deviceSession.endpoint, deviceSession.accessToken).then(setAgents)
  }, [deviceSession])

  // 点击外部关闭
  useEffect(() => {
    if (!plusOpen) return
    function handlePointerDown(event: MouseEvent) {
      if (plusRef.current?.contains(event.target as Node)) return
      setPlusOpen(false)
      setAgentSubOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [plusOpen])

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
    <div className={cn('ui-surface', streaming && 'surface-streaming', 'focus-within:border-ring')}>
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
        {/* 左侧：+ 菜单，自定义弹窗与模型选择器保持一致 */}
        <div ref={plusRef} className="relative">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn('size-7', plusOpen && 'bg-foreground/6 text-foreground')}
            aria-label="更多选项"
            aria-expanded={plusOpen}
            onClick={() => {
              setPlusOpen(v => !v)
              if (plusOpen) setAgentSubOpen(false)
            }}
          >
            <Plus className="size-4" />
          </Button>

          {plusOpen ? (
            <div className="absolute bottom-full left-0 z-50 mb-1">
              <div role="dialog" className="w-40 ui-popover-panel">
                <div className="ui-popover-list">
                  {/* Agent 行，hover 展开二级 */}
                  <button
                    type="button"
                    className={cn(
                      'ui-menu-item w-full rounded-control hover:bg-accent hover:text-accent-foreground',
                      agentSubOpen && 'bg-accent text-foreground',
                    )}
                    onMouseEnter={() => setAgentSubOpen(true)}
                  >
                    <span className="min-w-0 flex-1 truncate text-left leading-normal">Agent</span>
                    <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
                  </button>
                </div>
              </div>

              {/* Agent 二级菜单 */}
              {agentSubOpen ? (
                <div className="absolute bottom-0 left-full z-50" onMouseLeave={() => setAgentSubOpen(false)}>
                  <div role="menu" className="w-40 ui-popover-panel">
                    <div className="ui-popover-list">
                      {agents.map(agent => {
                        const selected = sessionSettings?.agentId === agent.id
                        return (
                          <button
                            key={agent.id}
                            type="button"
                            className={cn(
                              'ui-menu-item w-full rounded-control hover:bg-accent hover:text-accent-foreground',
                              selected && 'bg-accent text-foreground',
                            )}
                            onClick={() => {
                              void onUpdateSession({ agentId: agent.id })
                              setPlusOpen(false)
                              setAgentSubOpen(false)
                            }}
                          >
                            <span className="min-w-0 flex-1 truncate text-left">{agent.name}</span>
                            {selected ? <Check className="size-3.5 shrink-0" strokeWidth={2} /> : null}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-inline-sm">
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
