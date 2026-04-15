import type { ExperimentSummary } from '@/lib/types'

interface ExperimentsCardProps {
  data: ExperimentSummary[] | undefined
  onClick: () => void
}

export function ExperimentsCard({ data, onClick }: ExperimentsCardProps) {
  const active = data?.filter((e) => e.status === 'active') ?? []
  const totalObservations = active.reduce((sum, e) => sum + e.observationCount, 0)
  const sentiment = active.reduce(
    (acc, e) => ({
      positive: acc.positive + e.sentimentBreakdown.positive,
      negative: acc.negative + e.sentimentBreakdown.negative,
      neutral: acc.neutral + e.sentimentBreakdown.neutral,
    }),
    { positive: 0, negative: 0, neutral: 0 }
  )

  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg border border-brain-surface bg-brain-raised p-5 text-left transition-colors hover:border-brain-accent/30 hover:bg-brain-hover"
    >
      <h2 className="text-sm font-medium text-foreground mb-2">Experiments</h2>
      {!data ? (
        <>
          <div className="h-7 w-8 rounded bg-brain-base animate-pulse" />
          <div className="h-3 w-24 rounded bg-brain-base animate-pulse mt-2" />
        </>
      ) : active.length > 0 ? (
        <>
          <p className="text-2xl font-semibold text-foreground">{active.length}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {totalObservations} observation{totalObservations !== 1 ? 's' : ''}
          </p>
          {totalObservations > 0 && (
            <div className="flex items-center gap-3 mt-1.5 text-xs">
              {sentiment.positive > 0 && (
                <span className="flex items-center gap-1 text-brain-green">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-brain-green" />
                  {sentiment.positive}
                </span>
              )}
              {sentiment.negative > 0 && (
                <span className="flex items-center gap-1 text-red-400">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400" />
                  {sentiment.negative}
                </span>
              )}
              {sentiment.neutral > 0 && (
                <span className="flex items-center gap-1 text-gray-400">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-gray-400" />
                  {sentiment.neutral}
                </span>
              )}
            </div>
          )}
          <div className="mt-2 space-y-0.5">
            {active.slice(0, 2).map((e) => (
              <p key={e.id} className="text-[11px] text-muted-foreground truncate">{e.name}</p>
            ))}
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">No active experiments.</p>
      )}
    </button>
  )
}
