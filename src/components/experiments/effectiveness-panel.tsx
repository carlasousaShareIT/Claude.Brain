import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

function TrendIcon({ trend }: { trend: string }) {
  switch (trend) {
    case 'improving':
      return <TrendingUp className="h-4 w-4 text-brain-green" />
    case 'declining':
      return <TrendingDown className="h-4 w-4 text-brain-red" />
    default:
      return <Minus className="h-4 w-4 text-[#62627a]" />
  }
}

function trendLabel(trend: string): string {
  switch (trend) {
    case 'improving':
      return 'Improving'
    case 'declining':
      return 'Declining'
    default:
      return 'Stable'
  }
}

export function EffectivenessPanel({ experimentId }: { experimentId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['experiment-effectiveness', experimentId],
    queryFn: () => api.getExperimentEffectiveness(experimentId),
  })

  if (isLoading) {
    return <p className="py-4 text-center text-xs text-[#62627a]">Loading...</p>
  }

  if (!data) {
    return <p className="py-4 text-center text-xs text-[#62627a]">No effectiveness data.</p>
  }

  const total =
    data.sentimentBreakdown.positive +
    data.sentimentBreakdown.negative +
    data.sentimentBreakdown.neutral
  const posWidth = total > 0 ? (data.sentimentBreakdown.positive / total) * 100 : 0
  const negWidth = total > 0 ? (data.sentimentBreakdown.negative / total) * 100 : 0
  const neuWidth = total > 0 ? (data.sentimentBreakdown.neutral / total) * 100 : 0

  return (
    <div className="space-y-3">
      {/* Suggest conclude banner */}
      {data.suggestConclude && data.suggestedConclusion && (
        <div className="rounded-lg bg-brain-accent/10 px-3 py-2 ring-1 ring-brain-accent/20">
          <p className="text-xs font-medium text-brain-accent">
            Clear signal — consider concluding as {data.suggestedConclusion}.
          </p>
        </div>
      )}

      {/* Not enough data warning */}
      {data.observationCount < 4 && (
        <div className="rounded-lg bg-brain-surface px-3 py-2 ring-1 ring-white/5">
          <p className="text-xs text-[#62627a]">
            Not enough data for trend analysis.
          </p>
        </div>
      )}

      {/* Sentiment breakdown bar */}
      <div className="rounded-lg bg-brain-raised px-3 py-2.5 ring-1 ring-white/5">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-[#62627a]">
          Sentiment breakdown
        </p>
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-brain-surface">
          {posWidth > 0 && (
            <div
              className="h-full bg-brain-green transition-all"
              style={{ width: `${posWidth}%` }}
            />
          )}
          {negWidth > 0 && (
            <div
              className="h-full bg-brain-red transition-all"
              style={{ width: `${negWidth}%` }}
            />
          )}
          {neuWidth > 0 && (
            <div
              className="h-full bg-[#62627a] transition-all"
              style={{ width: `${neuWidth}%` }}
            />
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1 text-brain-green">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brain-green" />
            {data.sentimentBreakdown.positive} positive
          </span>
          <span className="flex items-center gap-1 text-brain-red">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brain-red" />
            {data.sentimentBreakdown.negative} negative
          </span>
          <span className="flex items-center gap-1 text-[#62627a]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#62627a]" />
            {data.sentimentBreakdown.neutral} neutral
          </span>
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-2 gap-2">
        {/* Positive rate */}
        <div className="rounded-lg bg-brain-raised px-3 py-2 ring-1 ring-white/5">
          <p className="text-[10px] text-[#62627a]">Positive rate</p>
          <p className={cn('text-lg font-bold', data.positiveRate >= 70 ? 'text-brain-green' : data.positiveRate >= 40 ? 'text-brain-amber' : 'text-brain-red')}>
            {Math.round(data.positiveRate)}%
          </p>
        </div>

        {/* Trend */}
        <div className="rounded-lg bg-brain-raised px-3 py-2 ring-1 ring-white/5">
          <p className="text-[10px] text-[#62627a]">Trend</p>
          <div className="flex items-center gap-1.5">
            <TrendIcon trend={data.trend} />
            <span className="text-sm font-medium text-foreground">{trendLabel(data.trend)}</span>
          </div>
        </div>

        {/* Avg success rate */}
        {data.avgSuccessRate !== null && (
          <div className="rounded-lg bg-brain-raised px-3 py-2 ring-1 ring-white/5">
            <p className="text-[10px] text-[#62627a]">Avg success rate</p>
            <p className="text-lg font-bold text-foreground">
              {Math.round(data.avgSuccessRate)}%
            </p>
          </div>
        )}

        {/* Avg rework rate */}
        {data.avgReworkRate !== null && (
          <div className="rounded-lg bg-brain-raised px-3 py-2 ring-1 ring-white/5">
            <p className="text-[10px] text-[#62627a]">Avg rework rate</p>
            <p className={cn('text-lg font-bold', data.avgReworkRate <= 15 ? 'text-brain-green' : data.avgReworkRate <= 30 ? 'text-brain-amber' : 'text-brain-red')}>
              {Math.round(data.avgReworkRate)}%
            </p>
          </div>
        )}
      </div>

      {/* Observation count */}
      <p className="text-center text-[10px] text-[#62627a]">
        Based on {data.observationCount} observation{data.observationCount !== 1 ? 's' : ''}.
      </p>
    </div>
  )
}
