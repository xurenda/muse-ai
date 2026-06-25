import type { ContextUsage } from '@museai/shared'
import { formatTokenCount } from '@/lib/format-token-count'

export interface ContextUsageTriggerParts {
  percentText: string
  windowText: string
  percentValue: number | null
  tokensPending: boolean
}

function formatWindow(contextWindow: number | null): string {
  if (contextWindow === null || contextWindow <= 0) return '—'
  return formatTokenCount(contextWindow)
}

function formatPercentValue(percent: number | null, tokens: number | null): string {
  if (tokens === null) return '?'
  if (tokens === 0) return '0'
  if (percent === null) return '—'
  if (percent > 0 && percent < 10) return percent.toFixed(1)
  return String(Math.round(percent))
}

/** 状态栏上下文触发器数值部分（文案由组件 i18n 组装） */
export function formatContextUsageTriggerParts(contextUsage: ContextUsage | undefined, contextWindowOverride?: number | null): ContextUsageTriggerParts {
  const contextWindow = contextWindowOverride ?? contextUsage?.contextWindow ?? null
  const windowText = formatWindow(contextWindow)
  const tokens = contextUsage?.tokens ?? null

  if (tokens === null) {
    return { percentText: '?', windowText, percentValue: null, tokensPending: true }
  }

  let percent: number | null = null
  if (contextWindow !== null && contextWindow > 0) {
    percent = tokens === 0 ? 0 : (contextUsage?.percent ?? (tokens / contextWindow) * 100)
  } else {
    percent = contextUsage?.percent ?? null
  }

  return {
    percentText: formatPercentValue(percent, tokens),
    windowText,
    percentValue: percent,
    tokensPending: false,
  }
}

/** 进度条填充比例（0–100）；tokens 未知时为 null */
export function resolveContextUsageProgressPercent(parts: ContextUsageTriggerParts): number | null {
  if (parts.tokensPending || parts.percentValue === null) return null
  return Math.min(100, Math.max(0, parts.percentValue))
}
