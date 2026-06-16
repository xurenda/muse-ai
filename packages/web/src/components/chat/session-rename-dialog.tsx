import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface SessionRenameDialogProps {
  open: boolean
  initialName: string
  onOpenChange: (open: boolean) => void
  onConfirm: (name: string) => Promise<void>
}

export function SessionRenameDialog({ open, initialName, onOpenChange, onConfirm }: SessionRenameDialogProps) {
  const { t } = useTranslation('layout')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState(initialName)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
    }
    if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  const handleClose = () => {
    if (submitting) return
    onOpenChange(false)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    try {
      await onConfirm(trimmed)
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed top-1/2 left-1/2 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border/60 bg-background p-4 text-foreground shadow-md backdrop:bg-black/40"
      onClose={handleClose}
    >
      <form onSubmit={event => void handleSubmit(event)}>
        <h2 className="text-sm font-semibold">{t('sidebar.renameSessionTitle')}</h2>
        <div className="mt-3 space-y-2">
          <Label htmlFor="session-rename-input">{t('sidebar.renameSession')}</Label>
          <Input
            id="session-rename-input"
            value={name}
            maxLength={100}
            placeholder={t('sidebar.renameSessionPlaceholder')}
            autoFocus
            onChange={event => setName(event.target.value)}
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" disabled={submitting} onClick={handleClose}>
            {t('sidebar.renameSessionCancel')}
          </Button>
          <Button type="submit" size="sm" disabled={submitting || !name.trim()}>
            {t('sidebar.renameSessionConfirm')}
          </Button>
        </div>
      </form>
    </dialog>
  )
}
