interface AnalyticsExperiment {
  id: string
  name: string
  observationCount: number
  sentimentBreakdown: { positive: number; negative: number; neutral: number }
  recentObservation: string | null
  trend: 'positive' | 'negative' | 'neutral' | null
}

function TrendIndicator({ trend }: { trend: AnalyticsExperiment['trend'] }) {
  if (trend === 'positive') {
    return (
      <span className="text-[#34d399] text-xs font-medium" title="Positive trend">
        ▲
      </span>
    )
  }
  if (trend === 'negative') {
    return (
      <span className="text-[#f87171] text-xs font-medium" title="Negative trend">
        ▼
      </span>
    )
  }
  return (
    <span className="text-muted-foreground text-xs font-medium" title="Neutral trend">
      —
    </span>
  )
}

function SentimentBar({
  breakdown,
}: {
  breakdown: AnalyticsExperiment['sentimentBreakdown']
}) {
  const total = breakdown.positive + breakdown.negative + breakdown.neutral
  if (total === 0) return null

  const posWidth = (breakdown.positive / total) * 100
  const negWidth = (breakdown.negative / total) * 100
  const neutWidth = (breakdown.neutral / total) * 100

  return (
    <div
      className="flex h-1.5 w-full overflow-hidden rounded-full"
      title={`${breakdown.positive} positive · ${breakdown.negative} negative · ${breakdown.neutral} neutral`}
    >
      {posWidth > 0 && (
        <div
          className="h-full"
          style={{ width: `${posWidth}%`, backgroundColor: '#34d399' }}
        />
      )}
      {negWidth > 0 && (
        <div
          className="h-full"
          style={{ width: `${negWidth}%`, backgroundColor: '#f87171' }}
        />
      )}
      {neutWidth > 0 && (
        <div
          className="h-full"
          style={{ width: `${neutWidth}%`, backgroundColor: '#62627a' }}
        />
      )}
    </div>
  )
}

function ExperimentCard({ experiment }: { experiment: AnalyticsExperiment }) {
  return (
    <div className="rounded-md bg-brain-base p-3 ring-1 ring-white/5 space-y-2">
      {/* Name + trend + badge */}
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {experiment.name}
        </span>
        <TrendIndicator trend={experiment.trend} />
        <span className="shrink-0 rounded-full bg-brain-surface px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
          {experiment.observationCount}{' '}
          {experiment.observationCount === 1 ? 'observation' : 'observations'}
        </span>
      </div>

      {/* Sentiment mini-bar */}
      {experiment.observationCount > 0 && (
        <SentimentBar breakdown={experiment.sentimentBreakdown} />
      )}

      {/* Recent observation preview */}
      {experiment.recentObservation != null && (
        <p className="truncate text-xs text-muted-foreground">
          {experiment.recentObservation}
        </p>
      )}
    </div>
  )
}

export function ExperimentTracker({ data }: { data: AnalyticsExperiment[] }) {
  if (data.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">No active experiments.</p>
    )
  }

  return (
    <div className="space-y-2">
      {data.map((experiment) => (
        <ExperimentCard key={experiment.id} experiment={experiment} />
      ))}
    </div>
  )
}
