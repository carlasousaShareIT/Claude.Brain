import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ObserverWatcher, SessionLifecycle } from '@/lib/types'

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '0s'
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return `${n}`
}

/** Extract the parent session UUID from a JSONL path.
 *  Main agents: .../<uuid>.jsonl → uuid
 *  Subagents:   .../<uuid>/subagents/<agent-id>.jsonl → uuid */
function extractParentSession(watcher: ObserverWatcher): string {
  const normalized = watcher.jsonlPath.replace(/\\/g, '/')
  const subagentMatch = normalized.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/subagents\//)
  if (subagentMatch) return subagentMatch[1]
  const mainMatch = normalized.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/)
  if (mainMatch) return mainMatch[1]
  return watcher.sessionId
}

function WatcherRow({ watcher }: { watcher: ObserverWatcher }) {
  const isActive = watcher.totalEvents > 0
  const metrics = watcher.currentMetrics

  return (
    <div className="rounded-md bg-brain-base p-3 space-y-2 ring-1 ring-white/5">
      <div className="flex items-center gap-2">
        {isActive && (
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brain-green opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brain-green" />
          </span>
        )}
        <span className="text-xs font-semibold text-foreground truncate">{watcher.agentName}</span>
        {watcher.missionId && (
          <Badge variant="outline" className="text-[9px] text-brain-accent border-brain-accent/30">
            {watcher.missionId}
          </Badge>
        )}
        <span className="ml-auto shrink-0 text-[10px] text-[#62627a]">
          {watcher.lastEventAt ? `active ${relativeTime(watcher.lastEventAt)}` : `started ${relativeTime(watcher.startedAt)}`}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[10px] text-[#62627a]">
          <span className="text-foreground/70 font-medium">{metrics.totalCalls}</span> calls
        </span>
        <span className="text-[10px] text-[#62627a]">
          <span className="text-foreground/70 font-medium">{formatDuration(metrics.durationMs)}</span>
        </span>
        <span className="text-[10px] text-[#62627a]">
          <span className="text-foreground/70 font-medium">{formatTokens(metrics.outputTokens)}</span> out
        </span>
        <span className="text-[10px] text-[#62627a]">
          <span className="text-foreground/70 font-medium">{formatTokens(metrics.cacheReadTokens)}</span> cache
        </span>
        <span className="text-[10px] text-[#62627a]">
          <span className="text-foreground/70 font-medium">{formatTokens(metrics.inputTokens + metrics.cacheCreationTokens)}</span> new input
        </span>
        <span
          className={cn(
            'text-[10px]',
            metrics.violationCount > 0 ? 'text-brain-red' : 'text-[#62627a]',
          )}
        >
          <span className="font-medium">{metrics.violationCount}</span> violations
        </span>
      </div>
    </div>
  )
}

interface SessionGroup {
  parentSessionId: string
  label: string | null
  project: string | null
  watchers: ObserverWatcher[]
}

export function WatchersCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['observer-watchers'],
    queryFn: () => api.getWatchers(),
    refetchInterval: 5000,
  })

  const { data: sessions } = useQuery({
    queryKey: ['session-lifecycles'],
    queryFn: () => api.listSessionLifecycles({ limit: 50 }),
    staleTime: 30_000,
  })

  // Build a lookup from session ID → session info
  const sessionMap = useMemo(() => {
    const map = new Map<string, SessionLifecycle>()
    if (sessions) {
      for (const s of sessions) map.set(s.id, s)
    }
    return map
  }, [sessions])

  const [showAll, setShowAll] = useState(false)

  // Live watchers: had an event in the last 5 minutes
  const LIVE_WINDOW_MS = 5 * 60 * 1000
  const liveWatchers = useMemo(() => {
    if (!data) return []
    const cutoff = Date.now() - LIVE_WINDOW_MS
    return data.filter(w => {
      if (w.lastEventAt && new Date(w.lastEventAt).getTime() > cutoff) return true
      return false
    })
  }, [data])

  // All watchers that ever had events (for "show all" mode)
  const allActiveWatchers = useMemo(() => {
    if (!data) return []
    return data.filter(w => w.totalEvents > 0 || w.currentMetrics.durationMs > 0)
  }, [data])

  const activeWatchers = showAll ? allActiveWatchers : liveWatchers
  const hiddenCount = allActiveWatchers.length - liveWatchers.length

  // Group by parent session (extracted from JSONL path)
  const groups = useMemo<SessionGroup[]>(() => {
    if (activeWatchers.length === 0) return []
    const map = new Map<string, ObserverWatcher[]>()
    for (const w of activeWatchers) {
      const parentId = extractParentSession(w)
      const existing = map.get(parentId)
      if (existing) {
        existing.push(w)
      } else {
        map.set(parentId, [w])
      }
    }
    return Array.from(map.entries()).map(([parentId, watchers]) => {
      const session = sessionMap.get(parentId)
      return {
        parentSessionId: parentId,
        label: session?.label ?? null,
        project: session?.project ?? null,
        watchers,
      }
    })
  }, [activeWatchers, sessionMap])

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-4">
        <p className="text-xs text-muted-foreground">Loading watchers...</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header with count + show all toggle */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-[10px]">
          {liveWatchers.length} live
        </Badge>
        {hiddenCount > 0 && (
          <button
            onClick={() => setShowAll(v => !v)}
            className="text-[10px] text-[#62627a] hover:text-foreground transition-colors"
          >
            {showAll ? 'hide' : `+${hiddenCount} recent`}
          </button>
        )}
      </div>

      {/* Empty state */}
      {activeWatchers.length === 0 && (
        <div className="flex items-center gap-2 rounded-md bg-brain-base p-3">
          <p className="text-xs text-[#62627a]">
            No live agents. Watchers appear when agents produce events.
          </p>
        </div>
      )}

      {/* Grouped by parent session */}
      {groups.map((group) => (
        <div key={group.parentSessionId} className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-brain-accent">
              {group.parentSessionId.slice(0, 8)}
            </span>
            {group.label && (
              <span className="text-[10px] font-medium text-foreground/80 truncate">
                {group.label}
              </span>
            )}
            {group.project && (
              <Badge variant="secondary" className="text-[9px] text-muted-foreground">
                {group.project}
              </Badge>
            )}
            <span className="text-[10px] text-[#62627a]">
              {group.watchers.length} watcher{group.watchers.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-1.5">
            {group.watchers.map((w) => (
              <WatcherRow key={w.key} watcher={w} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
