import { useState, useCallback } from 'react'
import {
  Loader2,
  Play,
  Eye,
  EyeOff,
  ArrowUpCircle,
  X,
  AlertTriangle,
  Clock,
  Trash2,
  Copy,
  CheckCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn, truncate } from '@/lib/utils'
import { useBrainAudit } from '@/hooks/use-brain-audit'
import { useArchived } from '@/hooks/use-archived'
import type { AuditFinding, AuditReport, SectionName } from '@/lib/types'

const SECTION_COLORS: Record<string, string> = {
  workingStyle: 'text-brain-accent',
  architecture: 'text-brain-green',
  agentRules: 'text-brain-amber',
  decisions: 'text-brain-red',
}

const TYPE_ICONS: Record<AuditFinding['type'], typeof Copy> = {
  duplicate: Copy,
  stale: Clock,
  noise: Trash2,
  promotable: ArrowUpCircle,
  aging_decision: AlertTriangle,
}

const TYPE_LABELS: Record<AuditFinding['type'], string> = {
  duplicate: 'Duplicates',
  stale: 'Stale',
  noise: 'Noise',
  promotable: 'Promotable',
  aging_decision: 'Aging decisions',
}

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days} day${days === 1 ? '' : 's'} ago`
  if (hours > 0) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  if (minutes > 0) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  return 'just now'
}

function SummaryBadges({ report }: { report: AuditReport }) {
  const { summary } = report
  const items: Array<{ key: string; count: number; color: string }> = [
    { key: 'Duplicates', count: summary.duplicates, color: 'text-brain-amber' },
    { key: 'Stale', count: summary.stale, color: 'text-brain-amber' },
    { key: 'Noise', count: summary.noise, color: 'text-brain-amber' },
    { key: 'Promotable', count: summary.promotable, color: 'text-brain-green' },
    { key: 'Aging', count: summary.agingDecisions, color: 'text-brain-red' },
  ]

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Badge
          key={item.key}
          variant="secondary"
          className={cn('text-[10px]', item.count > 0 ? item.color : 'text-[#62627a]')}
        >
          {item.key}: {item.count}
        </Badge>
      ))}
    </div>
  )
}

function FindingRow({
  finding,
  reportId,
  isDismissed,
  onDismiss,
  onPromote,
  onArchive,
  onMerge,
}: {
  finding: AuditFinding
  reportId: number
  isDismissed: boolean
  onDismiss: (reportId: number, findingId: string) => void
  onPromote: (decisionId: number, findingId: string) => void
  onArchive: (section: string, text: string, findingId: string) => void
  onMerge: (keepSection: string, keepText: string, archiveSection: string, archiveText: string, findingId: string) => void
}) {
  const Icon = TYPE_ICONS[finding.type]
  const [expanded, setExpanded] = useState(false)
  const toggle = useCallback(() => setExpanded(v => !v), [])

  return (
    <div className={cn('rounded-md bg-brain-base p-3 space-y-1.5', isDismissed && 'opacity-50')}>
      {finding.type === 'duplicate' && finding.relatedText ? (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5 shrink-0 text-brain-amber" />
              <span className="text-[10px] text-brain-amber font-medium">
                {finding.similarity != null && `${Math.round(finding.similarity * 100)}% similar`}
              </span>
            </div>
            {!isDismissed && (
              <Button
                variant="ghost"
                size="xs"
                className="text-[10px] text-[#62627a] hover:text-brain-red"
                onClick={() => onDismiss(reportId, finding.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          {/* Entry A */}
          <div className="rounded bg-brain-raised/50 p-2">
            <div className="flex items-start gap-2">
              <Badge
                variant="secondary"
                className={cn('text-[9px] shrink-0', SECTION_COLORS[finding.section] ?? 'text-muted-foreground')}
              >
                {finding.section}
              </Badge>
              <p
                className="text-[10px] text-foreground leading-snug flex-1 cursor-pointer hover:text-brain-accent transition-colors"
                onClick={toggle}
              >
                {expanded ? finding.text : truncate(finding.text, 120)}
              </p>
              {!isDismissed && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-[10px] text-brain-accent hover:text-brain-accent"
                    onClick={() => onMerge(finding.section, finding.text, finding.relatedSection!, finding.relatedText!, finding.id)}
                  >
                    Merge into this
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-[10px] text-[#62627a] hover:text-brain-red"
                    onClick={() => onArchive(finding.section, finding.text, finding.id)}
                  >
                    Archive
                  </Button>
                </div>
              )}
            </div>
          </div>
          {/* Entry B */}
          <div className="rounded bg-brain-raised/50 p-2">
            <div className="flex items-start gap-2">
              <Badge
                variant="secondary"
                className={cn('text-[9px] shrink-0', SECTION_COLORS[finding.relatedSection ?? ''] ?? 'text-muted-foreground')}
              >
                {finding.relatedSection}
              </Badge>
              <p
                className="text-[10px] text-[#62627a] leading-snug flex-1 cursor-pointer hover:text-brain-accent transition-colors"
                onClick={toggle}
              >
                {expanded ? finding.relatedText : truncate(finding.relatedText, 120)}
              </p>
              {!isDismissed && finding.relatedSection && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-[10px] text-brain-accent hover:text-brain-accent"
                    onClick={() => onMerge(finding.relatedSection!, finding.relatedText!, finding.section, finding.text, finding.id)}
                  >
                    Merge into this
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-[10px] text-[#62627a] hover:text-brain-red"
                    onClick={() => onArchive(finding.relatedSection!, finding.relatedText!, finding.id)}
                  >
                    Archive
                  </Button>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-start gap-2">
            <Icon className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', finding.severity === 'warning' ? 'text-brain-amber' : 'text-[#62627a]')} />
            <Badge
              variant="secondary"
              className={cn('text-[10px] shrink-0', SECTION_COLORS[finding.section] ?? 'text-muted-foreground')}
            >
              {finding.section}
            </Badge>
            <p
              className="text-xs text-foreground leading-snug flex-1 cursor-pointer hover:text-brain-accent transition-colors"
              onClick={toggle}
            >
              {expanded ? finding.text : truncate(finding.text, 80)}
            </p>
            <div className="flex items-center gap-1 shrink-0">
              {finding.type === 'promotable' && !isDismissed && (
                <Button
                  variant="ghost"
                  size="xs"
                  className="text-[10px] text-brain-green hover:text-brain-green"
                  onClick={() => onPromote(finding.entryId, finding.id)}
                >
                  Promote
                </Button>
              )}
              {(finding.type === 'stale' || finding.type === 'noise' || finding.type === 'promotable') && !isDismissed && (
                <Button
                  variant="ghost"
                  size="xs"
                  className="text-[10px] text-[#62627a] hover:text-brain-red"
                  onClick={() => onArchive(finding.section, finding.text, finding.id)}
                >
                  Archive
                </Button>
              )}
              {!isDismissed && (
                <Button
                  variant="ghost"
                  size="xs"
                  className="text-[10px] text-[#62627a] hover:text-brain-red"
                  onClick={() => onDismiss(reportId, finding.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
          <p className="text-[10px] text-[#62627a] pl-5">{finding.detail}</p>
        </>
      )}
      {(finding.type === 'stale' || finding.type === 'aging_decision') && finding.ageDays != null && (
        <p className="text-[10px] text-[#62627a] pl-5">
          Age: {finding.ageDays} day{finding.ageDays === 1 ? '' : 's'}
        </p>
      )}
    </div>
  )
}

export function AuditFindingsCard() {
  const { latestAudit, runAudit, dismissFinding, promoteDecision, mergeEntries } = useBrainAudit()
  const { archive } = useArchived()
  const [showDismissed, setShowDismissed] = useState(false)
  const [expandedTypes, setExpandedTypes] = useState<Set<AuditFinding['type']>>(new Set())

  const report = latestAudit.data
  const isLoading = latestAudit.isLoading
  const isRunning = runAudit.isPending
  const isError = latestAudit.isError

  const toggleType = (type: AuditFinding['type']) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const handleDismiss = (reportId: number, findingId: string) => {
    dismissFinding.mutate({ reportId, findingId })
  }

  const handlePromote = (decisionId: number, findingId: string) => {
    if (!report) return
    promoteDecision.mutate({ decisionId }, {
      onSuccess: () => {
        dismissFinding.mutate({ reportId: report.id, findingId })
      },
    })
  }

  const handleArchive = (section: string, text: string, findingId: string) => {
    if (!report) return
    archive.mutate({ section: section as SectionName, text }, {
      onSuccess: () => {
        dismissFinding.mutate({ reportId: report.id, findingId })
      },
    })
  }

  const handleMerge = (keepSection: string, keepText: string, archiveSection: string, archiveText: string, findingId: string) => {
    if (!report) return
    mergeEntries.mutate({ keepSection, keepText, archiveSection, archiveText }, {
      onSuccess: () => {
        dismissFinding.mutate({ reportId: report.id, findingId })
      },
    })
  }

  // Loading state.
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-4">
        <Loader2 className="h-4 w-4 animate-spin text-brain-accent" />
        <p className="text-xs text-muted-foreground">Loading audit data...</p>
      </div>
    )
  }

  // Error state (404 = no audits yet, other errors are real).
  if (isError && latestAudit.error && 'status' in latestAudit.error && (latestAudit.error as { status: number }).status !== 404) {
    return (
      <div className="space-y-2 p-1">
        <p className="text-xs text-brain-red">Failed to load audit data.</p>
        <Button variant="secondary" size="sm" onClick={() => runAudit.mutate()} disabled={isRunning}>
          {isRunning ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Play className="mr-1.5 h-3 w-3" />}
          Run audit
        </Button>
      </div>
    )
  }

  // No audits yet.
  if (!report) {
    return (
      <div className="space-y-2 p-1">
        <p className="text-xs text-[#62627a]">No audits have been run yet.</p>
        <Button variant="secondary" size="sm" onClick={() => runAudit.mutate()} disabled={isRunning}>
          {isRunning ? (
            <>
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="mr-1.5 h-3 w-3" />
              Run your first audit
            </>
          )}
        </Button>
      </div>
    )
  }

  const dismissed = new Set(report.dismissed)
  const activeFindings = report.findings.filter((f) => !dismissed.has(f.id))
  const dismissedFindings = report.findings.filter((f) => dismissed.has(f.id))

  // Group findings by type.
  const grouped = new Map<AuditFinding['type'], AuditFinding[]>()
  for (const f of showDismissed ? report.findings : activeFindings) {
    const list = grouped.get(f.type) ?? []
    list.push(f)
    grouped.set(f.type, list)
  }

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <SummaryBadges report={report} />
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-[#62627a]">
            Last run: {relativeTime(report.createdAt)}
          </span>
          <Button variant="secondary" size="sm" onClick={() => runAudit.mutate()} disabled={isRunning}>
            {isRunning ? (
              <>
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="mr-1.5 h-3 w-3" />
                Run audit now
              </>
            )}
          </Button>
        </div>
      </div>

      {/* All clear message */}
      {activeFindings.length === 0 && dismissedFindings.length === 0 && (
        <div className="flex items-center gap-2 rounded-md bg-brain-base p-3">
          <CheckCircle className="h-4 w-4 text-brain-green" />
          <p className="text-xs text-brain-green">All clear. No findings in the latest audit.</p>
        </div>
      )}

      {/* Dismissed toggle */}
      {dismissedFindings.length > 0 && (
        <Button
          variant="ghost"
          size="xs"
          className="text-[10px] text-[#62627a]"
          onClick={() => setShowDismissed(!showDismissed)}
        >
          {showDismissed ? (
            <>
              <EyeOff className="mr-1 h-3 w-3" />
              Hide {dismissedFindings.length} dismissed
            </>
          ) : (
            <>
              <Eye className="mr-1 h-3 w-3" />
              Show {dismissedFindings.length} dismissed
            </>
          )}
        </Button>
      )}

      {/* Finding sections */}
      {Array.from(grouped.entries()).map(([type, findings]) => {
        const isExpanded = expandedTypes.has(type)
        const Icon = TYPE_ICONS[type]

        return (
          <div key={type} className="space-y-1.5">
            <button
              className="flex items-center gap-1.5 text-xs text-foreground hover:text-brain-accent transition-colors w-full text-left"
              onClick={() => toggleType(type)}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="font-medium">{TYPE_LABELS[type]}</span>
              <Badge variant="secondary" className="text-[10px]">
                {findings.length}
              </Badge>
              <span className="text-[10px] text-[#62627a] ml-auto">
                {isExpanded ? 'collapse' : 'expand'}
              </span>
            </button>

            {isExpanded && (
              <div className="space-y-1.5 pl-1">
                {findings.map((f) => (
                  <FindingRow
                    key={f.id}
                    finding={f}
                    reportId={report.id}
                    isDismissed={dismissed.has(f.id)}
                    onDismiss={handleDismiss}
                    onPromote={handlePromote}
                    onArchive={handleArchive}
                    onMerge={handleMerge}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
