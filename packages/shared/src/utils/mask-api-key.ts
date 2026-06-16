/** 掩码 API Key：保留前 3 位与后 2 位，不足 5 位则返回 **** */
export function maskApiKey(key: string): string {
  const trimmed = key.trim()
  if (trimmed.length < 5) {
    return '****'
  }
  return `${trimmed.slice(0, 3)}****${trimmed.slice(-2)}`
}
