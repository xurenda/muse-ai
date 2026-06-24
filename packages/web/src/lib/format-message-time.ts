/** 格式化消息时间戳，分级显示：当天 HH:mm，同年跨天 MM-DD HH:mm，跨年 YYYY-MM-DD HH:mm */
export function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()

  const hhmm = date.toLocaleTimeString('zh', { hour: '2-digit', minute: '2-digit', hour12: false })
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const yyyy = date.getFullYear()

  const isToday = date.toDateString() === now.toDateString()
  if (isToday) return hhmm

  const isSameYear = yyyy === now.getFullYear()
  if (isSameYear) return `${mm}-${dd} ${hhmm}`

  return `${yyyy}-${mm}-${dd} ${hhmm}`
}
