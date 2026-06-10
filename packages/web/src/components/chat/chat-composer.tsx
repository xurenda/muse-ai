import { ArrowUp, Paperclip, Square } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AttachmentChips } from '@/components/chat/attachment-chips'
import { WorkspaceChip } from '@/components/chat/workspace-chip'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { SessionMessageDelivery } from '@/hooks/use-chat-session'
import { useTranslation } from '@/hooks/use-translation'
import {
  canSendComposerMessage,
  composeMessageWithAttachments,
  MAX_ATTACHMENTS,
  readComposerFiles,
  type ComposerAttachment,
} from '@/utils/composer-attachment'
import { cn } from '@/utils/cn'

const TEXTAREA_MAX_HEIGHT = 200

interface ChatComposerProps {
  value: string
  onChange: (value: string) => void
  onSendMessage: (message: string, delivery: SessionMessageDelivery) => void
  isLoading: boolean
  isSending: boolean
  onStop: () => void
  workspace: string
  workspaceReadOnly: boolean
  onWorkspaceChange: (cwd: string) => void
}

export function ChatComposer({
  value,
  onChange,
  onSendMessage,
  isLoading,
  isSending,
  onStop,
  workspace,
  workspaceReadOnly,
  onWorkspaceChange,
}: ChatComposerProps) {
  const { t } = useTranslation('chat')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  const [isDragOver, setIsDragOver] = useState(false)

  const canSend = canSendComposerMessage(value, attachments) && !isLoading

  const attachmentLabels = {
    attachment: t('attachments.sectionLabel'),
    binary: t('attachments.statusBinary'),
    tooLarge: t('attachments.statusTooLarge'),
    readFailed: t('attachments.statusReadFailed'),
  }

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, TEXTAREA_MAX_HEIGHT)}px`
  }, [value])

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const incoming = Array.from(files)
      if (incoming.length === 0) return

      const remaining = MAX_ATTACHMENTS - attachments.length
      if (remaining <= 0) return

      const next = await readComposerFiles(incoming.slice(0, remaining))
      setAttachments((current) => [...current, ...next])
    },
    [attachments.length],
  )

  const removeAttachment = useCallback((id: string) => {
    setAttachments((current) => current.filter((item) => item.id !== id))
  }, [])

  const submit = useCallback(
    (delivery: SessionMessageDelivery) => {
      if (!canSendComposerMessage(value, attachments) || isLoading) return
      if (!isSending && delivery !== 'prompt') return

      const message = composeMessageWithAttachments(value, attachments, attachmentLabels)
      setAttachments([])
      onSendMessage(message, delivery)
    },
    [attachmentLabels, attachments, isLoading, isSending, onSendMessage, value],
  )

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit(isSending ? 'steer' : 'prompt')
      return
    }

    if (event.key === 'Enter' && event.shiftKey && isSending) {
      event.preventDefault()
      submit('followUp')
    }
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (event: React.DragEvent) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setIsDragOver(false)
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragOver(false)
    if (isLoading) return
    void addFiles(event.dataTransfer.files)
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-border/60 bg-background shadow-sm transition-colors',
        'focus-within:border-ring focus-within:ring-1 focus-within:ring-ring',
        isDragOver && 'border-ring ring-1 ring-ring',
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = event.target.files
          if (files) {
            void addFiles(files)
          }
          event.target.value = ''
        }}
      />

      <AttachmentChips attachments={attachments} onRemove={removeAttachment} />

      <Textarea
        ref={textareaRef}
        className="max-h-[200px] min-h-11 resize-none border-0 bg-transparent px-3 py-2.5 shadow-none focus-visible:ring-0"
        rows={1}
        placeholder={isSending ? t('input.placeholderStreaming') : t('input.placeholder')}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
      />

      <div className="flex items-center justify-between gap-2 px-2 pb-2">
        <div className="flex min-w-0 items-center gap-0.5">
          <WorkspaceChip value={workspace} readOnly={workspaceReadOnly} onChange={onWorkspaceChange} />

          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton
                  type="button"
                  disabled={isLoading || attachments.length >= MAX_ATTACHMENTS}
                  aria-label={t('attachments.add')}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="size-3.5" strokeWidth={2} />
                </IconButton>
              </TooltipTrigger>
              <TooltipContent side="top">{t('attachments.add')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <TooltipProvider delayDuration={300}>
          <div className="flex shrink-0 items-center gap-1">
            {isSending ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={isLoading}
                    onClick={onStop}
                    aria-label={t('input.stop')}
                  >
                    <Square className="size-3.5 fill-current" strokeWidth={0} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">{t('input.stop')}</TooltipContent>
              </Tooltip>
            ) : null}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  disabled={!canSend}
                  onClick={() => submit(isSending ? 'steer' : 'prompt')}
                  aria-label={isSending ? t('input.steer') : t('input.send')}
                >
                  <ArrowUp className="size-4" strokeWidth={2} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{isSending ? t('input.steer') : t('input.send')}</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
    </div>
  )
}
