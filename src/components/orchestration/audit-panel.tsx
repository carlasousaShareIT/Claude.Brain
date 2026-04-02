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

function humanizeCheck(check: string): string {
  return CHECK_LABELS[check] ?? check
}

export function AuditPanel({ sessionId }: { sessionId: string }) {
  const { data: audit, isLoading } = useQuery({
    queryKey: ['orchestration-audit', sessionId],
    queryFn: () => api.getOrchestrationAudit(sessionId),
  })

  if (isLoading) {
    return <p className="py-4 text-center text-xs text-[#62627a]">Loading...</p>
  }

  if (!audit) {
    return <p className="py-4 text-center text-xs text-[#62627a]">No audit data.</p>
  }

  const passRate = audit.totalChecks > 0 ? (audit.passed / audit.totalChecks) * 100 : 0

  return (
    <div className="space-y-3">
      {/* Score summary */}
      <div className="rounded-lg bg-brain-raised px-3 py-2.5 ring-1 ring-white/5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {audit.passed}/{audit.totalChecks} checks passed
          </span>
          {audit.label && (
            <span className="text-[10px] text-[#62627a]">{audit.label}</span>
          )}
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-brain-surface">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              passRate >= 80 ? 'bg-brain-green' : passRate >= 50 ? 'bg-brain-amber' : 'bg-brain-red',
            )}
            style={{ width: `${passRate}%` }}
          />
        </div>
      </div>

      {/* Findings */}
      <div className="space-y-1">
        {audit.findings.map((finding) => (
          <div
            key={finding.check}
            className="flex items-start gap-2 rounded bg-brain-raised px-3 py-2 ring-1 ring-white/5"
          >
            {finding.passed ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brain-green" />
            ) : (
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brain-red" />
            )}
            <div className="min-w-0 flex-1">
              <span className="text-xs font-medium text-foreground">
                {humanizeCheck(finding.check)}
              </span>
              <p className="text-[10px] leading-snug text-[#62627a]">{finding.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
