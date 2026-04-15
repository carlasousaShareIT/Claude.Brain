import { useUIStore } from '@/stores/ui-store'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Shield, ShieldOff, ChevronRight } from 'lucide-react'
import type { ObserverWatcher } from '@/lib/types'

function isRecentlyActive(lastEventAt: string | null): boolean {
  if (!lastEventAt) return false
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
  return new Date(lastEventAt).getTime() > fiveMinutesAgo
}

export function ObserverStrip() {
  const pushView = useUIStore((s) => s.pushView)

  const { data: watchers } = useQuery({
    queryKey: ['watchers'],
    queryFn: api.getWatchers,
  })

  const { data: violationStats } = useQuery({
    queryKey: ['violation-stats'],
    queryFn: api.getViolationStats,
  })

  const { data: config } = useQuery({
    queryKey: ['observer-config'],
    queryFn: api.getObserverConfig,
  })

  const liveCount = watchers?.filter((w: ObserverWatcher) => isRecentlyActive(w.lastEventAt)).length ?? 0
  const violations24h = violationStats?.recent24h ?? 0
  const isPassive = config?.mode === 'passive'

  return (
    <button
      type="button"
      className="flex h-8 w-full shrink-0 cursor-pointer items-center gap-3 border-b border-brain-surface bg-brain-raised/60 px-4 text-left hover:bg-brain-hover transition-colors"
      onClick={() => pushView('observer')}
    >
      {/* Live dot + count */}
      <span className="flex items-center gap-1.5">
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            liveCount > 0 ? 'animate-pulse bg-brain-green' : 'bg-[#62627a]',
          )}
        />
        <span className="text-[10px] text-[#62627a]">
          <span className="font-medium text-foreground/70">{liveCount}</span> live
        </span>
      </span>

      <span className="text-[#62627a]">|</span>

      {/* Violations */}
      <span className="text-[10px] text-[#62627a]">
        <span
          className={cn(
            'font-medium',
            violations24h > 0 ? 'text-brain-amber' : 'text-foreground/70',
          )}
        >
          {violations24h}
        </span>{' '}
        violations (24h)
      </span>

      <span className="text-[#62627a]">|</span>

      {/* Mode badge — only render when config has loaded */}
      {config && (
        <span
          className={cn(
            'flex items-center gap-1 text-[10px]',
            isPassive ? 'text-brain-amber' : 'text-brain-green',
          )}
        >
          {isPassive ? (
            <>
              <ShieldOff className="h-3 w-3" />
              Passive
            </>
          ) : (
            <>
              <Shield className="h-3 w-3" />
              Active
            </>
          )}
        </span>
      )}

      {/* Spacer + expand hint */}
      <ChevronRight className="ml-auto h-3 w-3 text-[#62627a]" />
    </button>
  )
}
