import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Shield, ShieldOff, Filter, ChevronDown, ChevronRight } from 'lucide-react'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ObserverViolation } from '@/lib/types'

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-brain-red bg-brain-red/10 border-brain-red/20',
  error: 'text-brain-red bg-brain-red/10 border-brain-red/20',
  warning: 'text-brain-amber bg-brain-amber/10 border-brain-amber/20',
  info: 'text-brain-accent bg-brain-accent/10 border-brain-accent/20',
}

const SEVERITY_TEXT: Record<string, string> = {
  error: 'text-brain-red',
  warning: 'text-brain-amber',
  info: 'text-brain-accent',
}

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

function formatContextValue(value: unknown): string {
  if (value === null || value === undefined) return '\u2014'
  if (typeof value === 'number') return value.toLocaleString()
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function formatContextKey(key: string): string {
  // camelCase to spaced: readCount -> read count, silenceSeconds -> silence seconds
  return key.replace(/([A-Z])/g, ' $1').toLowerCase().trim()
}

function ViolationRow({ violation }: { violation: ObserverViolation }) {
  const [expanded, setExpanded] = useState(false)
  const hasDetails = !!(
    violation.context ||
    violation.missionId ||
    violation.taskId
  )

  return (
    <div className="rounded-md bg-brain-base p-2.5 space-y-1">
      <div className="flex items-start gap-2">
        <Badge
          variant="outline"
          className={cn('shrink-0 text-[9px] border', SEVERITY_COLORS[violation.severity])}
        >
          {violation.severity}
        </Badge>
        <Badge
          variant="secondary"
          className="shrink-0 text-[9px] text-muted-foreground"
        >
          {violation.type}
        </Badge>
        <p className="text-xs text-foreground leading-snug flex-1 min-w-0">
          {violation.message}
        </p>
        <span className="shrink-0 text-[10px] text-[#62627a]">
          {relativeTime(violation.createdAt)}
        </span>
        {hasDetails && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="shrink-0 text-[#62627a] hover:text-foreground transition-colors"
          >
            {expanded
              ? <ChevronDown className="h-3.5 w-3.5" />
              : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 pl-0.5">
        {violation.agent && (
          <span className="text-[10px] text-brain-accent">{violation.agent}</span>
        )}
        {violation.sessionId && (
          <span className="text-[10px] text-[#62627a] font-mono">
            {expanded ? violation.sessionId : violation.sessionId.slice(0, 8)}
          </span>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-1.5 border-t border-white/5 pt-1.5 space-y-1.5">
          {violation.context && Object.keys(violation.context).length > 0 && (
            <div>
              <span className="text-[10px] font-medium text-[#62627a] uppercase tracking-wider">Context</span>
              <div className="mt-0.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                {Object.entries(violation.context).map(([key, value]) => (
                  <div key={key} className="contents">
                    <span className="text-[10px] text-[#62627a]">{formatContextKey(key)}</span>
                    <span className="text-[10px] text-foreground/70 font-mono">{formatContextValue(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(violation.missionId || violation.taskId) && (
            <div className="flex gap-3 text-[10px] text-[#62627a]">
              {violation.missionId && (
                <span>Mission: <span className="text-foreground/70 font-mono">{violation.missionId}</span></span>
              )}
              {violation.taskId && (
                <span>Task: <span className="text-foreground/70 font-mono">{violation.taskId}</span></span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ViolationsCard() {
  const [filterAgent, setFilterAgent] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterSession, setFilterSession] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const violations = useQuery({
    queryKey: ['violations', filterAgent, filterType, filterSession],
    queryFn: () =>
      api.getViolations({
        agent: filterAgent || undefined,
        type: filterType || undefined,
        session: filterSession || undefined,
      }),
  })

  const stats = useQuery({
    queryKey: ['violation-stats'],
    queryFn: api.getViolationStats,
  })

  const config = useQuery({
    queryKey: ['observer-config'],
    queryFn: api.getObserverConfig,
  })

  const violationsList = Array.isArray(violations.data) ? violations.data : []

  // Bug 3 fix: derive filter options from unfiltered aggregates (stats), not from filtered list.
  const { agents, types } = useMemo(() => {
    if (stats.data) {
      return {
        agents: Object.keys(stats.data.byAgent).sort(),
        types: Object.keys(stats.data.byType).sort(),
      }
    }
    // Fallback if stats not loaded yet: derive from current list.
    const agentSet = new Set<string>()
    const typeSet = new Set<string>()
    for (const v of violationsList) {
      if (v.agent) agentSet.add(v.agent)
      typeSet.add(v.type)
    }
    return { agents: [...agentSet].sort(), types: [...typeSet].sort() }
  }, [stats.data, violationsList])

  const isPassive = config.data?.mode === 'passive'

  if (violations.isLoading && stats.isLoading) {
    return (
      <div className="flex items-center gap-2 p-4">
        <p className="text-xs text-muted-foreground">Loading violations...</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header with calibration badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {stats.data && (
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="text-[10px]">
                Total: {stats.data.total}
              </Badge>
              <Badge variant="secondary" className="text-[10px] text-brain-accent">
                Last 24h: {stats.data.recent24h}
              </Badge>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {config.data && (
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] gap-1',
                isPassive
                  ? 'text-brain-amber border-brain-amber/30'
                  : 'text-brain-green border-brain-green/30',
              )}
            >
              {isPassive ? (
                <>
                  <ShieldOff className="h-3 w-3" />
                  Passive (calibrating)
                </>
              ) : (
                <>
                  <Shield className="h-3 w-3" />
                  Active
                </>
              )}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="xs"
            className="text-[10px] text-[#62627a]"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-3 w-3 mr-1" />
            Filter
          </Button>
        </div>
      </div>

      {/* Type breakdown badges */}
      {stats.data?.byType && Object.keys(stats.data.byType).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(stats.data.byType).map(([type, count]) => (
            <Badge
              key={type}
              variant="secondary"
              className={cn(
                'text-[10px] cursor-pointer',
                filterType === type ? 'text-brain-accent ring-1 ring-brain-accent/30' : 'text-[#62627a]',
              )}
              onClick={() => setFilterType(filterType === type ? '' : type)}
            >
              {type}: {count}
            </Badge>
          ))}
        </div>
      )}

      {/* Filter bar */}
      {showFilters && (
        <div className="flex gap-2 flex-wrap">
          <select
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            className="h-7 rounded-md bg-brain-surface border border-brain-surface px-2 text-xs text-foreground outline-none focus:border-foreground/20"
          >
            <option value="">All agents</option>
            {agents.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-7 rounded-md bg-brain-surface border border-brain-surface px-2 text-xs text-foreground outline-none focus:border-foreground/20"
          >
            <option value="">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            type="text"
            value={filterSession}
            onChange={(e) => setFilterSession(e.target.value)}
            placeholder="Session ID..."
            className="h-7 w-32 rounded-md bg-brain-surface border border-brain-surface px-2 text-xs text-foreground placeholder:text-[#8585a0] outline-none focus:border-foreground/20"
          />
          {(filterAgent || filterType || filterSession) && (
            <Button
              variant="ghost"
              size="xs"
              className="text-[10px] text-[#62627a]"
              onClick={() => {
                setFilterAgent('')
                setFilterType('')
                setFilterSession('')
              }}
            >
              Clear
            </Button>
          )}
        </div>
      )}

      {/* Violation list */}
      {violationsList.length === 0 ? (
        <div className="flex items-center gap-2 rounded-md bg-brain-base p-3">
          <AlertTriangle className="h-4 w-4 text-[#62627a]" />
          <p className="text-xs text-[#62627a]">No violations recorded.</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {violationsList.map((v) => (
            <ViolationRow key={v.id} violation={v} />
          ))}
        </div>
      )}

      {/* Severity breakdown from stats */}
      {stats.data?.bySeverity && Object.keys(stats.data.bySeverity).length > 0 && (
        <div className="flex items-center gap-3 text-[10px]">
          {Object.entries(stats.data.bySeverity).map(([severity, count]) => (
            <span key={severity} className={cn('flex items-center gap-1', SEVERITY_TEXT[severity] ?? 'text-[#62627a]')}>
              <span className="font-medium">{count}</span> {severity}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
