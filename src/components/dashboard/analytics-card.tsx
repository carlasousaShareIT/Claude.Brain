import { cn } from '@/lib/utils'
import type { AnalyticsSummary } from '@/lib/types'

interface AnalyticsCardProps {
  data: AnalyticsSummary | undefined
  onClick: () => void
}

export function AnalyticsCard({ data, onClick }: AnalyticsCardProps) {
  if (!data) {
    return (
      <button
        onClick={onClick}
        className="w-full rounded-lg border border-brain-surface bg-brain-raised p-5 text-left transition-colors hover:border-brain-accent/30 hover:bg-brain-hover"
      >
        <h2 className="text-sm font-medium text-foreground mb-2">Analytics</h2>
        <div className="h-7 w-12 rounded bg-brain-base animate-pulse" />
        <div className="h-3 w-24 rounded bg-brain-base animate-pulse mt-2" />
      </button>
    )
  }

  const rates = Object.entries(data.compliance.rates)
  const avgRate = rates.length > 0
    ? rates.reduce((sum, [, r]) => sum + r.rate, 0) / rates.length
    : 0
  const pct = Math.round(avgRate * 100)

  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg border border-brain-surface bg-brain-raised p-5 text-left transition-colors hover:border-brain-accent/30 hover:bg-brain-hover"
    >
      <h2 className="text-sm font-medium text-foreground mb-2">Analytics</h2>
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            'text-2xl font-bold',
            pct >= 80 && 'text-brain-green',
            pct >= 50 && pct < 80 && 'text-brain-amber',
            pct < 50 && 'text-red-400',
          )}
        >
          {pct}%
        </span>
        <span className="text-xs text-muted-foreground">compliance</span>
      </div>
      <div className="mt-1.5 space-y-0.5">
        {rates.map(([gate, r]) => (
          <div key={gate} className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">{gate.replace(/_/g, ' ')}</span>
            <span className={cn(
              r.rate >= 0.8 ? 'text-brain-green' : r.rate >= 0.5 ? 'text-brain-amber' : 'text-red-400'
            )}>
              {Math.round(r.rate * 100)}%
            </span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground/60 mt-1.5">
        {data.analyzedSessions} session{data.analyzedSessions !== 1 ? 's' : ''} analyzed.
      </p>
    </button>
  )
}
