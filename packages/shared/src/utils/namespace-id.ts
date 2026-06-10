/**
 * 将命名空间 id（如 acme/code-tools）转为本地相对路径片段。
 * 禁止 `..` 与绝对路径。
 */
export function namespaceIdToRelativePath(id: string): string {
  const trimmed = id.trim()
  if (trimmed.length === 0) {
    throw new Error('资源 id 不能为空')
  }
  if (trimmed.startsWith('/') || trimmed.includes('..')) {
    throw new Error(`无效的资源 id: ${id}`)
  }
  return trimmed.split('/').filter(Boolean).join('/')
}
