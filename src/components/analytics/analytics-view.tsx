import { useAnalytics } from '@/hooks/use-analytics'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MetricCard } from '@/components/metrics/metric-card'
import { QueryError } from '@/components/ui/query-error'
import { ComplianceScorecard } from './compliance-scorecard'
import { ViolationFeed } from './violation-feed'
import { ProjectSplit } from './project-split'
import { ExperimentTracker } from './experiment-tracker'

export function AnalyticsView() {
  const { data, isLoading, isError, refetch } = useAnalytics(30)

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading analytics...</p>
      </div>
    )
  }

  if (isError) {
    return <QueryError message="Failed to load analytics." onRetry={refetch} />
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-[#62627a]">No analytics data available.</p>
      </div>
    )
  }

  const rateValues = Object.values(data.compliance.rates)
  const totalPassed = rateValues.reduce((sum, r) => sum + r.passed, 0)
  const totalApplicable = rateValues.reduce((sum, r) => sum + r.total, 0)
  const overallPct = totalApplicable > 0 ? Math.round((totalPassed / totalApplicable) * 100) : 0

  return (
    <ScrollArea className="h-full">
      <div className="p-4 pb-8">
        {/* Summary bar */}
        <div className="mb-4 flex items-baseline gap-3">
          <span className="text-3xl tabular-nums font-semibold text-foreground">
            {overallPct}%
          </span>
          <span className="text-sm text-muted-foreground">overall compliance</span>
          <span className="text-xs text-[#62627a]">
            ({data.analyzedSessions} sessions analyzed)
          </span>
        </div>

        {/* 2-column grid */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <MetricCard title="Compliance scorecard">
            <ComplianceScorecard data={data.compliance} />
          </MetricCard>

          <MetricCard title="Violation feed">
            <ViolationFeed data={data.violations} />
          </MetricCard>

          <MetricCard title="Project split">
            <ProjectSplit data={data.projectSplit} />
          </MetricCard>

          <MetricCard title="Experiment tracker">
            <ExperimentTracker data={data.experiments} />
          </MetricCard>
        </div>
      </div>
    </ScrollArea>
  )
}
