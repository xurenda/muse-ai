export interface HeaderEntry {
  key: string
  value: string
}

export function headersRecordToEntries(
  headers: Record<string, string> | undefined,
): HeaderEntry[] {
  if (!headers) {
    return []
  }
  return Object.entries(headers).map(([key, value]) => ({ key, value }))
}

export function headersEntriesToRecord(
  entries: HeaderEntry[] | undefined,
): Record<string, string> | undefined {
  if (!entries?.length) {
    return undefined
  }

  const record: Record<string, string> = {}
  for (const entry of entries) {
    const key = entry.key.trim()
    if (!key) {
      continue
    }
    record[key] = entry.value
  }

  return Object.keys(record).length > 0 ? record : undefined
}

export function mergeHeaderRecords(
  ...sources: Array<Record<string, string> | undefined>
): Record<string, string> | undefined {
  const merged: Record<string, string> = {}
  for (const source of sources) {
    if (!source) {
      continue
    }
    Object.assign(merged, source)
  }
  return Object.keys(merged).length > 0 ? merged : undefined
}
