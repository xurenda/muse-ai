import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

interface SessionDeleteDialogProps {
  open: boolean
  sessionName: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
}

export function SessionDeleteDialog({ open, sessionName, onOpenChange, onConfirm }: SessionDeleteDialogProps) {
  const { t } = useTranslation('layout')
  const dialogRef = useRef<HTMLDialogElement>(null)
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

  const handleConfirm = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await onConfirm()
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
      <h2 className="text-sm font-semibold">{t('sidebar.deleteSessionTitle')}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t('sidebar.deleteSessionDescription', { name: sessionName })}</p>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" disabled={submitting} onClick={handleClose}>
          {t('sidebar.deleteSessionCancel')}
        </Button>
        <Button type="button" variant="destructive" size="sm" disabled={submitting} onClick={() => void handleConfirm()}>
          {t('sidebar.deleteSessionConfirm')}
        </Button>
      </div>
    </dialog>
  )
}
