/** 格式化缓存命中率展示 */
export function formatHitRatePercent(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null
  if (value > 0 && value < 10) return `${value.toFixed(1)}%`
  return `${Math.round(value)}%`
}
