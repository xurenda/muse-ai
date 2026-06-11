import type { GetSessionTraceResponse, LlmTraceEntry } from '@muse-ai/shared'

/** 默认折叠的 trace 条目类型 */
export const TRACE_TYPES_COLLAPSED_BY_DEFAULT = new Set([
  'agent_start',
  'agent_end',
  'turn_start',
  'turn_end',
  'message_start',
  'message_end',
  'message_update',
])

export function isTraceEntryCollapsedByDefault(type: string): boolean {
  return TRACE_TYPES_COLLAPSED_BY_DEFAULT.has(type)
}

export function formatTraceTimestamp(iso: string, locale: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }

  return new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

export function getTraceTypeAccentClass(type: string): string {
  switch (type) {
    case 'provider_request':
      return 'border-l-primary'
    case 'after_provider_response':
      return 'border-l-foreground/40'
    case 'tool_call':
      return 'border-l-sidebar-accent-foreground/60'
    case 'tool_result':
      return 'border-l-primary/50'
    case 'transform_context':
      return 'border-l-muted-foreground/50'
    default:
      return 'border-l-border'
  }
}

export function formatTraceEntryContent(entry: LlmTraceEntry): string {
  if (entry.type === 'provider_request' && entry.payload !== undefined) {
    return JSON.stringify(entry.payload, null, 2)
  }

  const { timestamp: _timestamp, turnIndex: _turnIndex, type: _type, ...rest } = entry
  return JSON.stringify(rest, null, 2)
}

export function serializeTraceEntry(entry: LlmTraceEntry): string {
  return JSON.stringify(entry)
}

export function serializeTraceTurn(detail: GetSessionTraceResponse): string {
  if (detail.entries.length === 0) {
    return ''
  }

  return `${detail.entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`
}
