/** 格式化工具调用参数，供 UI 展示 */
export function formatToolInput(args: unknown): string {
  if (args === undefined || args === null) {
    return ''
  }
  if (typeof args === 'string') {
    return args
  }
  try {
    return JSON.stringify(args, null, 2)
  } catch {
    return String(args)
  }
}

/** 格式化工具返回结果，优先提取 AgentToolResult 的 text content */
export function formatToolOutput(value: unknown): string {
  if (value === undefined || value === null) {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'object' && value !== null && 'content' in value) {
    const content = (value as { content?: unknown }).content
    if (Array.isArray(content)) {
      const text = content
        .filter((part): part is { type: 'text'; text: string } => {
          return typeof part === 'object' && part !== null && 'type' in part && part.type === 'text'
        })
        .map((part) => part.text)
        .join('\n')
      if (text.trim()) {
        return text
      }
    }
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
