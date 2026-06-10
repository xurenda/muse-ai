export const MAX_ATTACHMENT_BYTES = 256 * 1024
export const MAX_ATTACHMENTS = 10

export type ComposerAttachmentStatus = 'ready' | 'binary' | 'too_large' | 'read_failed'

export interface ComposerAttachment {
  id: string
  name: string
  textContent: string | null
  status: ComposerAttachmentStatus
}

const TEXT_EXTENSIONS = new Set([
  'c',
  'cpp',
  'css',
  'csv',
  'go',
  'html',
  'java',
  'js',
  'json',
  'jsx',
  'kt',
  'md',
  'py',
  'rb',
  'rs',
  'sh',
  'sql',
  'svg',
  'toml',
  'ts',
  'tsx',
  'txt',
  'xml',
  'yaml',
  'yml',
])

const EXT_TO_LANG: Record<string, string> = {
  c: 'c',
  cpp: 'cpp',
  css: 'css',
  go: 'go',
  html: 'html',
  java: 'java',
  js: 'javascript',
  json: 'json',
  jsx: 'jsx',
  kt: 'kotlin',
  md: 'markdown',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  sh: 'bash',
  sql: 'sql',
  svg: 'xml',
  toml: 'toml',
  ts: 'typescript',
  tsx: 'tsx',
  txt: 'text',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
}

const BINARY_TYPE_PREFIXES = ['image/', 'audio/', 'video/', 'font/']
const BINARY_MIME_TYPES = new Set([
  'application/pdf',
  'application/zip',
  'application/gzip',
  'application/octet-stream',
])

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  if (lastDot <= 0) return ''
  return filename.slice(lastDot + 1).toLowerCase()
}

function isLikelyTextFile(file: File): boolean {
  if (file.type.startsWith('text/')) return true
  if (['application/json', 'application/javascript', 'application/xml'].includes(file.type)) {
    return true
  }
  if (BINARY_TYPE_PREFIXES.some((prefix) => file.type.startsWith(prefix))) return false
  if (BINARY_MIME_TYPES.has(file.type)) return false
  return TEXT_EXTENSIONS.has(getExtension(file.name))
}

function guessLanguage(filename: string): string {
  return EXT_TO_LANG[getExtension(filename)] ?? ''
}

function createAttachmentId(): string {
  return crypto.randomUUID()
}

function formatAttachmentSection(
  attachment: ComposerAttachment,
  labels: { attachment: string; binary: string; tooLarge: string; readFailed: string },
): string {
  if (attachment.status === 'binary') {
    return `${labels.attachment}: ${attachment.name}\n（${labels.binary}）`
  }
  if (attachment.status === 'too_large') {
    return `${labels.attachment}: ${attachment.name}\n（${labels.tooLarge}）`
  }
  if (attachment.status === 'read_failed') {
    return `${labels.attachment}: ${attachment.name}\n（${labels.readFailed}）`
  }

  const lang = guessLanguage(attachment.name)
  const fence = lang ? `\`\`\`${lang}` : '```'
  return `${labels.attachment}: ${attachment.name}\n${fence}\n${attachment.textContent ?? ''}\n\`\`\``
}

export interface ComposeAttachmentLabels {
  attachment: string
  binary: string
  tooLarge: string
  readFailed: string
}

/** 将附件内容拼入用户消息，发送前在前端完成 */
export function composeMessageWithAttachments(
  message: string,
  attachments: ComposerAttachment[],
  labels: ComposeAttachmentLabels,
): string {
  const trimmed = message.trim()
  const sections = attachments.map((item) => formatAttachmentSection(item, labels))

  if (sections.length === 0) {
    return trimmed
  }

  if (!trimmed) {
    return sections.join('\n\n')
  }

  return `${trimmed}\n\n---\n\n${sections.join('\n\n')}`
}

export function canSendComposerMessage(message: string, attachments: ComposerAttachment[]): boolean {
  if (message.trim().length > 0) return true
  return attachments.some((item) => item.status === 'ready')
}

async function readSingleFile(file: File): Promise<ComposerAttachment> {
  const base: ComposerAttachment = {
    id: createAttachmentId(),
    name: file.name,
    textContent: null,
    status: 'read_failed',
  }

  if (!isLikelyTextFile(file)) {
    return { ...base, status: 'binary' }
  }

  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { ...base, status: 'too_large' }
  }

  try {
    const textContent = await file.text()
    return { ...base, textContent, status: 'ready' }
  } catch {
    return { ...base, status: 'read_failed' }
  }
}

/** 从 FileList 读取为 Composer 附件 */
export async function readComposerFiles(files: FileList | File[]): Promise<ComposerAttachment[]> {
  const list = Array.from(files)
  return Promise.all(list.map((file) => readSingleFile(file)))
}
