import { timeAgo } from '@/lib/utils'
import type { SessionLifecycle } from '@/lib/types'

interface SessionsCardProps {
  data: SessionLifecycle[] | undefined
  onClick: () => void
}

export function SessionsCard({ data, onClick }: SessionsCardProps) {
  const sessions = data ?? []
  const activeSessions = sessions.filter((s) => !s.ended_at)
  const ended = sessions
    .filter((s) => s.ended_at)
    .sort((a, b) => (b.ended_at! > a.ended_at! ? 1 : -1))
    .slice(0, 3)

  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg border border-brain-surface bg-brain-raised p-5 text-left transition-colors hover:border-brain-accent/30 hover:bg-brain-hover"
    >
      <h2 className="text-sm font-medium text-foreground mb-2">Sessions</h2>
      {sessions.length > 0 ? (
        <>
          {activeSessions.length > 0 && (
            <>
              <p className="flex items-center gap-1.5 text-lg font-semibold text-foreground">
                <span className="inline-block h-2 w-2 rounded-full bg-brain-green animate-pulse" />
                {activeSessions.length} active
              </p>
              <div className="mt-1 space-y-0.5">
                {activeSessions.slice(0, 3).map((s) => (
                  <p key={s.id} className="text-[11px] text-brain-green/80 truncate">
                    {s.label || s.id.slice(0, 8)}
                  </p>
                ))}
              </div>
            </>
          )}
          {ended.length > 0 && (
            <div className="mt-1.5 space-y-1">
              <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wide">Recent</p>
              {ended.map((s) => (
                <div key={s.id} className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="text-muted-foreground truncate">{s.label || 'unnamed'}</span>
                  <span className="text-muted-foreground/60 shrink-0 text-[11px]">{timeAgo(s.ended_at!)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">No recent sessions.</p>
      )}
    </button>
  )
}
