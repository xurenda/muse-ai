import type { TranslationValues } from './types'

function resolveMessage(dictionary: Record<string, unknown>, key: string): string | undefined {
  const segments = key.split('.')
  let current: unknown = dictionary

  for (const segment of segments) {
    if (current === null || typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[segment]
  }

  return typeof current === 'string' ? current : undefined
}

function interpolate(template: string, values: TranslationValues): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
    const value = values[name]
    return value !== undefined ? String(value) : match
  })
}

/** 基于命名空间词典创建 t 函数 */
export function createTranslator(dictionary: Record<string, unknown>) {
  return (key: string, values?: TranslationValues): string => {
    const message = resolveMessage(dictionary, key)
    if (!message) {
      return key
    }
    return values ? interpolate(message, values) : message
  }
}
