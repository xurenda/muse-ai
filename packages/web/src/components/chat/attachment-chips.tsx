import { FileText, Image, X } from 'lucide-react'
import type { ComposerAttachment } from '@/utils/composer-attachment'
import { IconButton } from '@/components/ui/icon-button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslation } from '@/hooks/use-translation'

interface AttachmentChipsProps {
  attachments: ComposerAttachment[]
  onRemove: (id: string) => void
}

function getStatusHint(status: ComposerAttachment['status'], t: (key: string) => string): string | null {
  switch (status) {
    case 'binary':
      return t('attachments.statusBinary')
    case 'too_large':
      return t('attachments.statusTooLarge')
    case 'read_failed':
      return t('attachments.statusReadFailed')
    default:
      return null
  }
}

export function AttachmentChips({ attachments, onRemove }: AttachmentChipsProps) {
  const { t } = useTranslation('chat')

  if (attachments.length === 0) {
    return null
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-wrap gap-1.5 px-3 pt-2.5">
        {attachments.map((attachment) => {
          const hint = getStatusHint(attachment.status, t)
          const Icon = attachment.status === 'binary' ? Image : FileText

          const chip = (
            <span
              className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              <Icon className="size-3 shrink-0" strokeWidth={2} />
              <span className="max-w-[12rem] truncate">{attachment.name}</span>
              <IconButton
                type="button"
                className="size-4 rounded-sm"
                aria-label={t('attachments.remove')}
                onClick={() => onRemove(attachment.id)}
              >
                <X className="size-3" strokeWidth={2} />
              </IconButton>
            </span>
          )

          if (!hint) {
            return <span key={attachment.id}>{chip}</span>
          }

          return (
            <Tooltip key={attachment.id}>
              <TooltipTrigger asChild>{chip}</TooltipTrigger>
              <TooltipContent side="top">{hint}</TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
