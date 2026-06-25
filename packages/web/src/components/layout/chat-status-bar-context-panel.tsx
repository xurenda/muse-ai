import { ChevronDown, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { computeSessionCacheHitRate, hasSessionCacheUsage, type SessionSettingsResponse } from '@museai/shared'
import { HelpTooltip } from '@/components/ui/help-tooltip'
import { formatHitRatePercent } from '@/lib/format-hit-rate-percent'
import { formatTokenCount } from '@/lib/format-token-count'
import { formatContextUsageTriggerParts, resolveContextUsageProgressPercent } from '@/lib/format-context-usage-trigger'
import { cn } from '@/lib/utils'

interface ContextUsagePanelProps {
  sessionSettings: SessionSettingsResponse | null
  compacting: boolean
  disabled: boolean
  onCompact: () => Promise<boolean>
  onClose: () => void
}

function formatDetailPercent(percent: number | null): string {
  if (percent === null) return '—'
  if (percent > 0 && percent < 10) return `${percent.toFixed(1)}%`
  return `${Math.round(percent)}%`
}

function MetricRow({ label, value, tooltip }: { label: string; value: string; tooltip?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-0.5 shrink-0 tabular-nums text-foreground">
        {label}
        {tooltip ? <HelpTooltip content={tooltip} /> : null}
      </span>
      <span className="shrink-0 tabular-nums text-muted-foreground">{value}</span>
    </div>
  )
}

function progressToneClass(percent: number | null): string {
  if (percent === null) return 'bg-muted-foreground/30'
  if (percent > 90) return 'bg-destructive'
  if (percent > 70) return 'bg-orange-500'
  return 'bg-primary'
}

function formatTokensRatio(
  tokens: number | null,
  windowLabel: string,
  tokensPending: boolean,
  t: (key: string, options?: Record<string, string>) => string,
): string {
  const used = tokensPending || tokens === null ? '—' : `~${formatTokenCount(tokens)}`
  return t('contextPanel.tokensRatio', { used, limit: windowLabel })
}

export function ContextUsagePanel({ sessionSettings, compacting, disabled, onCompact, onClose }: ContextUsagePanelProps) {
  const { t } = useTranslation('chat')
  const panelRef = useRef<HTMLDivElement>(null)
  const contextUsage = sessionSettings?.contextUsage
  const tokenUsage = sessionSettings?.tokenUsage

  const parts = useMemo(() => formatContextUsageTriggerParts(contextUsage), [contextUsage])
  const progressPercent = resolveContextUsageProgressPercent(parts)
  const tokens = contextUsage?.tokens ?? null
  const percent = contextUsage?.percent ?? null
  const windowLabel = parts.windowText

  const hasSessionUsage = tokenUsage !== undefined && tokenUsage.total > 0
  const showCache = hasSessionCacheUsage(tokenUsage)
  const sessionHitRate = useMemo(() => computeSessionCacheHitRate(tokenUsage), [tokenUsage])
  const lastTurnHitRate = formatHitRatePercent(contextUsage?.lastTurnCacheHitRate)
  const [sessionExpanded, setSessionExpanded] = useState(true)

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (panelRef.current?.contains(target)) return
      if (target instanceof Element && target.closest('[data-context-usage-trigger]')) return
      onClose()
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [onClose])

  return (
    <div ref={panelRef} className="absolute bottom-full right-2 z-50 mb-1 w-[min(17rem,calc(100vw-1rem))] ui-popover-panel" role="dialog">
      <div className="space-y-2 px-3 pt-3 pb-2 text-xs">
        <div className="space-y-2">
          <div>
            <p className="font-medium text-foreground">{t('contextPanel.windowSection')}</p>
          </div>

          <button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setSessionExpanded(v => !v)}>
            <span className="shrink-0 tabular-nums text-muted-foreground">{formatDetailPercent(percent)}</span>
            <span className="flex items-center gap-1 shrink-0 tabular-nums text-muted-foreground">
              {formatTokensRatio(tokens, windowLabel, parts.tokensPending, t)}
              {sessionExpanded ? <ChevronDown className="size-3 text-muted-foreground" /> : <ChevronRight className="size-3 text-muted-foreground" />}
            </span>
          </button>

          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full transition-[width] duration-300', progressToneClass(progressPercent))}
              style={{ width: progressPercent === null ? '0%' : `${progressPercent}%` }}
            />
          </div>

          {parts.tokensPending ? <p className="text-[11px] leading-snug text-muted-foreground">{t('contextPanel.pendingHint')}</p> : null}
        </div>
      </div>

      {sessionExpanded && (
        <div className="border-t border-border px-3 py-3 text-xs">
          {hasSessionUsage ? (
            <div className="space-y-1.5">
              <MetricRow label={t('contextPanel.inputLabel')} value={formatTokenCount(tokenUsage.input)} tooltip={t('contextPanel.inputTooltip')} />
              {showCache ? (
                <MetricRow
                  label={t('contextPanel.cacheReadLabel')}
                  value={formatTokenCount(tokenUsage.cacheRead)}
                  tooltip={t('contextPanel.cacheReadTooltip')}
                />
              ) : null}
              <MetricRow label={t('contextPanel.outputLabel')} value={formatTokenCount(tokenUsage.output)} tooltip={t('contextPanel.outputTooltip')} />
              {showCache ? (
                <MetricRow
                  label={t('contextPanel.cacheWriteLabel')}
                  value={formatTokenCount(tokenUsage.cacheWrite)}
                  tooltip={t('contextPanel.cacheWriteTooltip')}
                />
              ) : null}
              <MetricRow label={t('contextPanel.totalLabel')} value={formatTokenCount(tokenUsage.total)} tooltip={t('contextPanel.totalTooltip')} />
              {showCache && lastTurnHitRate ? (
                <MetricRow label={t('contextPanel.lastTurnHitRateLabel')} value={lastTurnHitRate} tooltip={t('contextPanel.lastTurnHitRateTooltip')} />
              ) : null}
              {showCache && sessionHitRate !== null ? (
                <MetricRow
                  label={t('contextPanel.sessionHitRateLabel')}
                  value={formatHitRatePercent(sessionHitRate) ?? '—'}
                  tooltip={t('contextPanel.sessionHitRateTooltip')}
                />
              ) : null}
              {tokenUsage.costTotal !== undefined && tokenUsage.costTotal > 0 ? (
                <MetricRow label={t('contextPanel.costLabel')} value={`$${tokenUsage.costTotal.toFixed(3)}`} />
              ) : null}
            </div>
          ) : (
            <p className="text-muted-foreground">{t('contextPanel.sessionEmpty')}</p>
          )}
        </div>
      )}

      <div className="border-t border-border px-3 py-2">
        <button
          type="button"
          className="cursor-pointer text-xs text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={disabled || compacting}
          onClick={() => void onCompact()}
        >
          {compacting ? t('compactingContext') : t('compactContext')}
        </button>
      </div>
    </div>
  )
}

interface ContextUsageTriggerProps {
  parts: ReturnType<typeof formatContextUsageTriggerParts>
  open: boolean
  onToggle: () => void
}

export function ContextUsageTrigger({ parts, open, onToggle }: ContextUsageTriggerProps) {
  const { t } = useTranslation('chat')
  const toneClass =
    parts.percentValue !== null && parts.percentValue > 90
      ? 'text-destructive'
      : parts.percentValue !== null && parts.percentValue > 70
        ? 'text-orange-600 dark:text-orange-400'
        : undefined

  const percentText = parts.tokensPending ? '…' : `${parts.percentText}%`
  // 圆环参数
  const r = 5
  const circumference = 2 * Math.PI * r
  const filled = parts.percentValue !== null ? Math.min(parts.percentValue / 100, 1) : 0
  const dashOffset = circumference * (1 - filled)

  return (
    <button
      type="button"
      data-context-usage-trigger
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-label={t('contextPanel.triggerAriaLabel')}
      onClick={onToggle}
      className={cn(
        'inline-flex h-5 max-w-[min(100%,14rem)] cursor-pointer items-center gap-1 border-0 px-1.5 text-[11px] leading-none transition-colors',
        open ? 'bg-foreground/6 text-foreground' : 'text-muted-foreground hover:bg-foreground/6 hover:text-foreground',
        toneClass,
      )}
    >
      {/* 圆环进度图标 */}
      <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0 -rotate-90" aria-hidden>
        <circle cx="7" cy="7" r={r} fill="none" strokeWidth="1.5" className="stroke-current opacity-20" />
        <circle
          cx="7"
          cy="7"
          r={r}
          fill="none"
          strokeWidth="1.5"
          className="stroke-current"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      </svg>
      <span className="truncate tabular-nums">{percentText}</span>
    </button>
  )
}
