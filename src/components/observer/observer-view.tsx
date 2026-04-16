import { ScrollArea } from '@/components/ui/scroll-area'
import { MetricCard } from '@/components/metrics/metric-card'
import { WatchersCard } from '@/components/observer/watchers-card'
import { ViolationsCard } from '@/components/metrics/violations-card'
import { AgentMetricsCard } from '@/components/metrics/agent-metrics-card'
import { QueryError } from '@/components/ui/query-error'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, ShieldOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

function isRecentlyActive(lastEventAt: string | null): boolean {
  if (!lastEventAt) return false
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
  return new Date(lastEventAt).getTime() > fiveMinutesAgo
}

export function ObserverView() {
  const queryClient = useQueryClient()

  const { data: watchers, isLoading: watchersLoading, isError: watchersError, refetch: refetchWatchers } = useQuery({
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

  const toggleMode = useMutation({
    mutationFn: (newMode: 'passive' | 'active') =>
      api.patchObserverConfig({ mode: newMode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['observer-config'] })
    },
  })

  if (watchersLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading observer...</p>
      </div>
    )
  }

  if (watchersError) {
    return <QueryError message="Failed to load observer data." onRetry={refetchWatchers} />
  }

  const liveCount = watchers?.filter((w) => isRecentlyActive(w.lastEventAt)).length ?? 0
  const violations24h = violationStats?.recent24h ?? 0
  const isPassive = config?.mode === 'passive'
  const nextMode = isPassive ? 'active' : 'passive'

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Summary bar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-brain-surface bg-brain-raised px-4 py-2.5">
        <span className="text-[10px] text-[#62627a]">
          <span className="font-medium text-foreground/70">{liveCount}</span> live watchers
        </span>
        <span className="text-[10px] text-[#62627a]">
          <span className="font-medium text-foreground/70">{violations24h}</span> violations (24h)
        </span>
        {config && (
          <Badge
            variant="outline"
            className={cn(
              'cursor-pointer gap-1 text-[10px]',
              isPassive
                ? 'border-brain-amber/30 text-brain-amber'
                : 'border-brain-green/30 text-brain-green',
            )}
            onClick={() => {
              if (!toggleMode.isPending) toggleMode.mutate(nextMode)
            }}
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
          </Badge>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0 overflow-hidden">
        <div className="p-4 pb-8">
          <div className="space-y-3">
            <MetricCard title="Live watchers">
              <WatchersCard />
            </MetricCard>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <MetricCard title="Violations">
                <ViolationsCard />
              </MetricCard>
              <MetricCard title="Agent metrics">
                <AgentMetricsCard />
              </MetricCard>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
