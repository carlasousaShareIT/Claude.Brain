import type { MetricsData } from '@/lib/types'

interface HealthCardProps {
  data: MetricsData | undefined
  onClick: () => void
}

export function HealthCard({ data, onClick }: HealthCardProps) {
  if (!data) {
    return (
      <button
        onClick={onClick}
        className="w-full rounded-lg border border-brain-surface bg-brain-raised p-5 text-left transition-colors hover:border-brain-accent/30 hover:bg-brain-hover"
      >
        <h2 className="text-sm font-medium text-foreground mb-1">Brain Health</h2>
        <div className="h-4 w-20 rounded bg-brain-base animate-pulse" />
        <div className="h-3 w-32 rounded bg-brain-base animate-pulse mt-2" />
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg border border-brain-surface bg-brain-raised p-5 text-left transition-colors hover:border-brain-accent/30 hover:bg-brain-hover"
    >
      <h2 className="text-sm font-medium text-foreground mb-2">Brain Health</h2>
      <p className="text-2xl font-semibold text-foreground">{data.totalEntries}</p>
      <div className="mt-1.5 space-y-0.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-brain-green">{data.byConfidence.firm} firm</span>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-brain-amber">{data.byConfidence.tentative} tentative</span>
        </div>
        <p className="text-muted-foreground">
          {data.byStatus.open} open / {data.byStatus.resolved} resolved decisions
        </p>
        <p className="text-muted-foreground">
          avg age: {Math.round(data.avgAgeDays)}d
        </p>
        {data.archived > 0 && (
          <p className="text-muted-foreground/60">{data.archived} archived</p>
        )}
      </div>
    </button>
  )
}
