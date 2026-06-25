/** 紧凑展示 token 数量（k/M 单位保留一位小数，便于 streaming 时感知增量） */
export function formatTokenCount(count: number): string {
  if (count < 1000) return count.toString()
  if (count < 1_000_000) return `${(count / 1000).toFixed(1)}k`
  if (count < 10_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  return `${Math.round(count / 1_000_000)}M`
}
