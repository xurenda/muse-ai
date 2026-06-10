import { FolderOpen } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslation } from '@/hooks/use-translation'
import { isPickDirectorySupported, pickDirectory } from '@/utils/pick-directory'
import { addRecentWorkspace, getRecentWorkspaces } from '@/utils/recent-workspaces'
import { cn } from '@/utils/cn'

interface WorkspaceChipProps {
  value: string
  readOnly: boolean
  onChange: (cwd: string) => void
}

function getPathBasename(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '')
  const last = normalized.split('/').pop()
  return last ?? path
}

function WorkspaceChipLabel({ value, unsetLabel }: { value: string; unsetLabel: string }) {
  const display = value.trim() ? getPathBasename(value.trim()) : unsetLabel

  return (
    <>
      <FolderOpen className="size-3.5 shrink-0" strokeWidth={2} />
      <span className="truncate">{display}</span>
    </>
  )
}

export function WorkspaceChip({ value, readOnly, onChange }: WorkspaceChipProps) {
  const { t } = useTranslation('chat')
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const [recent, setRecent] = useState<string[]>([])
  const canBrowse = isPickDirectorySupported()

  useEffect(() => {
    if (open) {
      setDraft(value)
      setRecent(getRecentWorkspaces())
    }
  }, [open, value])

  const applyPath = useCallback(
    (path: string) => {
      const trimmed = path.trim()
      onChange(trimmed)
      if (trimmed) {
        addRecentWorkspace(trimmed)
      }
      setOpen(false)
    },
    [onChange],
  )

  const handleBrowse = useCallback(async () => {
    const selected = await pickDirectory()
    if (selected) {
      applyPath(selected)
    }
  }, [applyPath])

  const chipClassName = cn(
    'inline-flex max-w-[min(100%,14rem)] items-center gap-1.5 rounded-md px-2 py-1 text-xs',
    readOnly ? 'text-muted-foreground' : 'cursor-pointer text-muted-foreground hover:bg-foreground/6 hover:text-foreground',
  )

  if (readOnly) {
    const fullPath = value.trim() || t('workspace.unset')
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={chipClassName}>
              <WorkspaceChipLabel value={value} unsetLabel={t('workspace.unsetShort')} />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">{fullPath}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button type="button" className={chipClassName}>
          <WorkspaceChipLabel value={value} unsetLabel={t('workspace.pick')} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        className="w-80 p-3"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <div className="flex flex-col gap-2" onKeyDown={(event) => event.stopPropagation()}>
          <span className="text-xs text-muted-foreground">{t('workspace.label')}</span>
          <Input
            className="text-xs"
            placeholder={t('workspace.placeholder')}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                applyPath(draft)
              }
            }}
          />
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" className="flex-1" onClick={() => applyPath(draft)}>
              {t('workspace.confirm')}
            </Button>
            {canBrowse ? (
              <Button type="button" size="sm" variant="outline" onClick={() => void handleBrowse()}>
                {t('workspace.browse')}
              </Button>
            ) : null}
          </div>
        </div>
        {recent.length > 0 ? (
          <>
            <DropdownMenuSeparator className="my-2" />
            <span className="px-2 text-xs text-muted-foreground">{t('workspace.recent')}</span>
            {recent.map((item) => (
              <DropdownMenuItem key={item} className="text-xs" onSelect={() => applyPath(item)}>
                <FolderOpen className="size-3.5 shrink-0" strokeWidth={2} />
                <span className="truncate" title={item}>
                  {getPathBasename(item)}
                </span>
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
