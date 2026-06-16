import { Plus, Trash2 } from 'lucide-react'
import type { ProviderHeaderEntry } from '@muse-ai/shared'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'

interface HeadersEditorProps {
  label: string
  headers: ProviderHeaderEntry[]
  keyPlaceholder: string
  valuePlaceholder: string
  addLabel: string
  onChange: (headers: ProviderHeaderEntry[]) => void
}

export function HeadersEditor({ label, headers, keyPlaceholder, valuePlaceholder, addLabel, onChange }: HeadersEditorProps) {
  const rows = headers.length > 0 ? headers : [{ key: '', value: '' }]

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      {rows.map((header, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            className="min-w-0 flex-1"
            placeholder={keyPlaceholder}
            value={header.key}
            onChange={event => onChange(rows.map((item, itemIndex) => (itemIndex === index ? { ...item, key: event.target.value } : item)))}
          />
          <Input
            className="min-w-0 flex-1"
            placeholder={valuePlaceholder}
            value={header.value}
            onChange={event => onChange(rows.map((item, itemIndex) => (itemIndex === index ? { ...item, value: event.target.value } : item)))}
          />
          <IconButton
            type="button"
            disabled={rows.length <= 1 && !header.key && !header.value}
            onClick={() => onChange(rows.filter((_, itemIndex) => itemIndex !== index))}
          >
            <Trash2 className="size-3.5" strokeWidth={2} />
          </IconButton>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" className="w-fit" onClick={() => onChange([...rows, { key: '', value: '' }])}>
        <Plus className="size-3.5" strokeWidth={2} />
        {addLabel}
      </Button>
    </div>
  )
}
