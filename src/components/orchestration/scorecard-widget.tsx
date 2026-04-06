import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

const CHECK_LABELS: Record<string, string> = {
  brainQueriedBeforeTasks: 'Brain queried',
  profilesInjected: 'Profiles injected',
  decisionsRecorded: 'Decisions recorded',
  experimentsObserved: 'Experiments observed',
  missionTasksUpdated: 'Tasks updated',
  reviewerRunAfterChanges: 'Reviewer run',
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-brain-green'
  if (score >= 50) return 'text-brain-amber'
  return 'text-brain-red'
}

function scoreBgColor(score: number): string {
  if (score >= 80) return 'bg-brain-green/10 ring-brain-green/20'
  if (score >= 50) return 'bg-brain-amber/10 ring-brain-amber/20'
  return 'bg-brain-red/10 ring-brain-red/20'
}

export function ScorecardWidget({ sessionId }: { sessionId: string }) {
  const { data: scoreData, isLoading } = useQuery({
    queryKey: ['orchestration-score', sessionId],
    queryFn: () => api.getOrchestrationScore(sessionId),
  })

  if (isLoading) {
    return (
      <div className="flex h-24 items-center justify-center">
        <p className="text-xs text-[#62627a]">Loading...</p>
      </div>
    )
  }

  if (!scoreData) {
    return (
      <div className="flex h-24 items-center justify-center">
        <p className="text-xs text-[#62627a]">No score data.</p>
      </div>
    )
  }

  const pct = scoreData.maxScore > 0
    ? Math.round((scoreData.score / scoreData.maxScore) * 100)
    : 0

  const checks = Object.entries(scoreData.breakdown)

  return (
    <div className="space-y-2">
      {/* Score circle */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-14 w-14 shrink-0 items-center justify-center rounded-full ring-2',
            scoreBgColor(pct),
          )}
        >
          <span className={cn('text-xl font-bold', scoreColor(pct))}>{pct}</span>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">
            {scoreData.score}/{scoreData.maxScore} points
          </p>
          <p className="text-[10px] text-[#62627a]">
            {checks.filter(([, info]) => info.passed).length}/{checks.length} checks passed
          </p>
          {scoreData.label && (
            <p className="text-[10px] text-[#62627a]">{scoreData.label}</p>
          )}
        </div>
      </div>

      {/* Breakdown */}
      <div className="space-y-0.5">
        {checks.map(([check, info]) => (
          <div key={check} className="flex items-center gap-1.5 px-1 py-0.5">
            {info.passed ? (
              <CheckCircle2 className="h-3 w-3 shrink-0 text-brain-green" />
            ) : (
              <XCircle className="h-3 w-3 shrink-0 text-brain-red" />
            )}
            <span className="shrink-0 text-[10px] text-foreground/80">
              {CHECK_LABELS[check] ?? check}
            </span>
            {info.detail && (
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-right text-[9px]',
                  info.passed ? 'text-[#62627a]' : 'text-brain-red/60',
                )}
                title={info.detail}
              >
                {info.detail}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
