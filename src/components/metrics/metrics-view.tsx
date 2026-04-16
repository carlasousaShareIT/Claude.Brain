import { useMetrics } from '@/hooks/use-metrics'
import { useAutoHealth } from '@/hooks/use-health'
import { useUIStore } from '@/stores/ui-store'
import { ScrollArea } from '@/components/ui/scroll-area'
import { QueryError } from '@/components/ui/query-error'
import { MetricCard } from './metric-card'
import { SectionBreakdown } from './section-breakdown'
import { ConfidenceSplit } from './confidence-split'
import { DecisionStatus } from './decision-status'
import { ActivityChart } from './activity-chart'
import { StalenessCard } from './staleness-card'
import { HealthCard } from './health-card'
import { AuditFindingsCard } from './audit-findings-card'

export function MetricsView() {
  const activeProject = useUIStore((s) => s.activeProject)
  const { data, isLoading, isError, refetch } = useMetrics(activeProject || undefined)
  const autoHealth = useAutoHealth(true)

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading metrics...</p>
      </div>
    )
  }

  if (isError) {
    return <QueryError message="Failed to load metrics." onRetry={refetch} />
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-[#62627a]">No metrics data available.</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 pb-8">
        {/* Summary bar */}
        <div className="mb-4 flex items-baseline gap-3">
          <span className="text-3xl tabular-nums font-semibold text-foreground">
            {data.totalEntries}
          </span>
          <span className="text-sm text-muted-foreground">total entries</span>
          {data.archived > 0 && (
            <span className="text-xs text-[#62627a]">
              ({data.archived} archived)
            </span>
          )}
        </div>

        {/* 2-column grid */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <MetricCard title="Entries by section">
            <SectionBreakdown bySection={data.bySection} />
          </MetricCard>

          <MetricCard title="Confidence split">
            <ConfidenceSplit byConfidence={data.byConfidence} />
          </MetricCard>

          <MetricCard title="Decision status">
            <DecisionStatus byStatus={data.byStatus} />
          </MetricCard>

          <MetricCard title="Activity (last 30 days)">
            <ActivityChart activityByDay={data.activityByDay} />
          </MetricCard>

          <MetricCard title="Staleness & coverage" className="md:col-span-2">
            <StalenessCard
              avgAgeDays={data.avgAgeDays}
              oldestEntry={data.oldestEntry}
              newestEntry={data.newestEntry}
              sessionsCount={data.sessionsCount}
              annotationsCount={data.annotationsCount}
            />
          </MetricCard>

          <MetricCard title="Entry health" className="md:col-span-2">
            <HealthCard autoHealth={{ data: autoHealth.data, isLoading: autoHealth.isLoading }} />
          </MetricCard>

          <MetricCard title="Brain audit" className="md:col-span-2">
            <AuditFindingsCard />
          </MetricCard>
        </div>
      </div>
    </ScrollArea>
  )
}
