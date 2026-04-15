import { truncate } from '@/lib/utils'
import type { Reminder } from '@/lib/types'

interface RemindersCardProps {
  data: Reminder[] | undefined
  onClick: () => void
}

export function RemindersCard({ data, onClick }: RemindersCardProps) {
  const pending = data?.filter((r) => r.status === 'pending') ?? []
  const now = new Date()
  const overdue = pending.filter((r) => r.dueDate && new Date(r.dueDate) < now)
  const highPriority = pending.filter((r) => r.priority === 'high')

  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg border border-brain-surface bg-brain-raised p-5 text-left transition-colors hover:border-brain-accent/30 hover:bg-brain-hover"
    >
      <h2 className="text-sm font-medium text-foreground mb-2">Reminders</h2>
      {!data ? (
        <>
          <div className="h-7 w-8 rounded bg-brain-base animate-pulse" />
          <div className="h-3 w-20 rounded bg-brain-base animate-pulse mt-2" />
        </>
      ) : pending.length > 0 ? (
        <>
          <p className="text-2xl font-semibold text-foreground">{pending.length}</p>
          <div className="mt-1 flex items-center gap-2 text-xs">
            {overdue.length > 0 && (
              <span className="text-brain-amber">{overdue.length} overdue</span>
            )}
            {highPriority.length > 0 && (
              <span className="text-brain-accent">{highPriority.length} high</span>
            )}
          </div>
          <div className="mt-2 space-y-0.5">
            {pending.slice(0, 3).map((r) => (
              <p key={r.id} className="text-[11px] text-muted-foreground truncate">
                {r.priority === 'high' && <span className="text-brain-accent mr-1">!</span>}
                {truncate(r.text, 40)}
              </p>
            ))}
          </div>
        </>
      ) : (
        <p className="text-xs text-brain-green">All clear.</p>
      )}
    </button>
  )
}
