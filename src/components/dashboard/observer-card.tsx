import { cn } from '@/lib/utils'
import type { ObserverWatcher, ViolationStats } from '@/lib/types'

interface ObserverCardProps {
  watchers: ObserverWatcher[] | undefined
  stats: ViolationStats | undefined
  onClick: () => void
}

function isLive(w: ObserverWatcher): boolean {
  if (!w.lastEventAt) return false
  return new Date(w.lastEventAt).getTime() > Date.now() - 5 * 60 * 1000
}

export function ObserverCard({ watchers, stats, onClick }: ObserverCardProps) {
  const live = watchers?.filter(isLive) ?? []
  const stale = (watchers?.length ?? 0) - live.length

  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg border border-brain-surface bg-brain-raised p-5 text-left transition-colors hover:border-brain-accent/30 hover:bg-brain-hover"
    >
      <h2 className="text-sm font-medium text-foreground mb-2">Observer</h2>
      <div className="flex items-center gap-2">
        <span className="text-2xl font-semibold text-foreground">{live.length}</span>
        {live.length > 0 && (
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brain-green opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brain-green" />
          </span>
        )}
        <span className="text-xs text-muted-foreground">live</span>
      </div>
      <div className="mt-1.5 space-y-0.5 text-xs">
        {stats && (
          <p className={cn(stats.recent24h > 0 ? 'text-brain-amber' : 'text-muted-foreground')}>
            {stats.recent24h} violation{stats.recent24h !== 1 ? 's' : ''} (24h)
          </p>
        )}
        {stale > 0 && (
          <p className="text-muted-foreground">{stale} stale</p>
        )}
      </div>
      {live.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {live.slice(0, 2).map((w) => (
            <p key={w.key} className="text-[11px] text-muted-foreground truncate">
              {w.agentName || w.key}
            </p>
          ))}
        </div>
      )}
      {live.length === 0 && (
        <p className="text-[11px] text-muted-foreground mt-1.5">No active watchers.</p>
      )}
    </button>
  )
}
