import { Copy, Check, Pencil } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconButton } from '@/components/ui/icon-button'
import { formatMessageTime } from '@/lib/format-message-time'

interface UserMessageProps {
  content: string
  modeLabel?: string
  timestamp?: string
  onEdit?: (text: string) => void
}

export function UserMessage({ content, modeLabel, timestamp, onEdit }: UserMessageProps) {
  const { t } = useTranslation('chat')
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group flex flex-col items-end gap-1">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
        {modeLabel ? <p className="mb-1 text-[10px] uppercase tracking-wide opacity-80">{modeLabel}</p> : null}
        <p className="whitespace-pre-wrap break-words">{content}</p>
      </div>
      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {timestamp ? <span className="text-xs text-muted-foreground tabular-nums">{formatMessageTime(timestamp)}</span> : null}
        <IconButton type="button" tooltip={t('copy')} aria-label={t('copy')} onClick={() => void handleCopy()}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </IconButton>
        {onEdit ? (
          <IconButton type="button" tooltip={t('edit')} aria-label={t('edit')} onClick={() => onEdit(content)}>
            <Pencil className="size-3.5" />
          </IconButton>
        ) : null}
      </div>
    </div>
  )
}
