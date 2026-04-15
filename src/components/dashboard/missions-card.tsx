import type { MissionSummary } from '@/lib/types'

interface MissionsCardProps {
  data: MissionSummary[] | undefined
  onClick: () => void
}

const Skeleton = () => (
  <>
    <div className="h-7 w-8 rounded bg-brain-base animate-pulse" />
    <div className="h-3 w-24 rounded bg-brain-base animate-pulse mt-2" />
  </>
)

export function MissionsCard({ data, onClick }: MissionsCardProps) {
  const active = data?.filter((m) => m.status === 'active') ?? []
  const totalPending = active.reduce((sum, m) => sum + m.taskCounts.pending, 0)
  const totalInProgress = active.reduce((sum, m) => sum + m.taskCounts.in_progress, 0)
  const totalCompleted = active.reduce((sum, m) => sum + m.taskCounts.completed, 0)
  const totalBlocked = active.reduce((sum, m) => sum + m.taskCounts.blocked, 0)
  const totalTasks = totalPending + totalInProgress + totalCompleted + totalBlocked

  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg border border-brain-surface bg-brain-raised p-5 text-left transition-colors hover:border-brain-accent/30 hover:bg-brain-hover"
    >
      <h2 className="text-sm font-medium text-foreground mb-2">Missions</h2>
      {!data ? <Skeleton /> : active.length > 0 ? (
        <>
          <p className="text-2xl font-semibold text-foreground">{active.length}</p>
          <div className="mt-1.5 space-y-0.5 text-xs">
            <p className="text-muted-foreground">
              {totalCompleted}/{totalTasks} tasks done
            </p>
            {totalInProgress > 0 && (
              <p className="text-brain-accent">{totalInProgress} in progress</p>
            )}
            {totalPending > 0 && (
              <p className="text-muted-foreground">{totalPending} pending</p>
            )}
            {totalBlocked > 0 && (
              <p className="text-brain-amber">{totalBlocked} blocked</p>
            )}
          </div>
          <div className="mt-2 space-y-0.5">
            {active.slice(0, 2).map((m) => (
              <p key={m.id} className="text-[11px] text-muted-foreground truncate">
                {m.name}
              </p>
            ))}
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">No active missions.</p>
      )}
    </button>
  )
}
