import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, ChevronUp, Filter } from 'lucide-react'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AgentMetricsSummary, ObserverViolation } from '@/lib/types'

type SortKey = 'agent' | 'totalToolCalls' | 'totalDurationMs' | 'totalTokens' | 'violationCount' | 'taskCount'

function formatDuration(ms: number): string {
  if (ms <= 0) return '\u2014'
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

function ToolDistribution({ dist }: { dist: Record<string, number> }) {
  const entries = Object.entries(dist).sort(([, a], [, b]) => b - a)
  const total = entries.reduce((sum, [, c]) => sum + c, 0)
  if (total === 0) return <span className="text-[10px] text-[#62627a]">No calls</span>

  return (
    <div className="flex flex-wrap gap-1">
      {entries.slice(0, 5).map(([tool, count]) => (
        <Badge key={tool} variant="secondary" className="text-[9px] text-[#62627a]">
          {tool}: {count} ({Math.round((count / total) * 100)}%)
        </Badge>
      ))}
      {entries.length > 5 && (
        <Badge variant="secondary" className="text-[9px] text-[#62627a]">
          +{entries.length - 5} more
        </Badge>
      )}
    </div>
  )
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-brain-red bg-brain-red/10 border-brain-red/20',
  error: 'text-brain-red bg-brain-red/10 border-brain-red/20',
  warning: 'text-brain-amber bg-brain-amber/10 border-brain-amber/20',
  info: 'text-brain-accent bg-brain-accent/10 border-brain-accent/20',
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

function formatContextKey(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').toLowerCase().trim()
}

function formatContextValue(value: unknown): string {
  if (value === null || value === undefined) return '\u2014'
  if (typeof value === 'number') return value.toLocaleString()
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function InlineViolationsList({ violations }: { violations: ObserverViolation[] }) {
  return (
    <div className="space-y-1">
      {violations.map((v) => (
        <div key={v.id} className="rounded bg-brain-surface/50 px-2 py-1.5 space-y-0.5">
          <div className="flex items-start gap-1.5 flex-wrap">
            <Badge
              variant="outline"
              className={cn('shrink-0 text-[9px] border', SEVERITY_COLORS[v.severity])}
            >
              {v.severity}
            </Badge>
            <Badge
              variant="secondary"
              className="shrink-0 text-[9px] text-muted-foreground"
            >
              {v.type}
            </Badge>
            <span className="text-[10px] text-foreground/80 leading-snug flex-1 min-w-0">
              {v.message}
            </span>
            <span className="shrink-0 text-[9px] text-[#62627a]">
              {relativeTime(v.createdAt)}
            </span>
          </div>
          {v.context && Object.keys(v.context).length > 0 && (
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0 pl-1">
              {Object.entries(v.context).map(([key, value]) => (
                <div key={key} className="contents">
                  <span className="text-[9px] text-[#62627a]">{formatContextKey(key)}</span>
                  <span className="text-[9px] text-foreground/60 font-mono">{formatContextValue(value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function AgentMetricRow({ agent }: { agent: AgentMetricsSummary }) {
  const [expanded, setExpanded] = useState(false)

  const { data: violations, isLoading: violationsLoading } = useQuery({
    queryKey: ['agent-violations', agent.agent, agent.sessionId],
    queryFn: () => api.getViolations({ agent: agent.agent, session: agent.sessionId || undefined }),
    enabled: expanded && agent.violationCount > 0,
  })

  return (
    <div className="rounded-md bg-brain-base p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-xs font-semibold text-foreground truncate">{agent.agent}</span>
          {agent.sessionLabel && (
            <span className="text-[10px] text-foreground/60 truncate">{agent.sessionLabel}</span>
          )}
          {agent.project && (
            <Badge variant="secondary" className="text-[9px] text-muted-foreground shrink-0">
              {agent.project}
            </Badge>
          )}
          {agent.violationCount > 0 && (
            <Badge variant="outline" className="text-[9px] text-brain-red border-brain-red/30 shrink-0">
              {agent.violationCount} violations
            </Badge>
          )}
        </div>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="shrink-0 text-[#62627a] hover:text-foreground transition-colors"
        >
          {expanded
            ? <ChevronDown className="h-3.5 w-3.5" />
            : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {agent.sessionId && (
          <span className="text-[10px] font-mono text-brain-accent">{agent.sessionId.slice(0, 8)}</span>
        )}
        <span className="text-[10px] text-[#62627a]">
          <span className="text-foreground/70 font-medium">{agent.totalToolCalls}</span> tool calls
        </span>
        <span className="text-[10px] text-[#62627a]">
          <span className="text-foreground/70 font-medium">{formatDuration(agent.totalDurationMs)}</span>
        </span>
        <span className="text-[10px] text-[#62627a]">
          <span className="text-foreground/70 font-medium">{formatTokens(agent.totalTokens)}</span> tokens
        </span>
      </div>

      {expanded && (
        <div className="mt-2 border-t border-white/5 pt-2 space-y-2">
          <div>
            <span className="text-[10px] font-medium text-[#62627a] uppercase tracking-wider">Tool distribution</span>
            <div className="mt-1">
              <ToolDistribution dist={agent.toolCallDistribution} />
            </div>
          </div>
          <div className="flex gap-x-4 gap-y-1 flex-wrap text-[10px] text-[#62627a]">
            <span>Total duration: <span className="text-foreground/70">{formatDuration(agent.totalDurationMs)}</span></span>
            <span>Avg tokens: <span className="text-foreground/70">{formatTokens(agent.avgTokens)}</span></span>
            {agent.lastActive && (
              <span>Last active: <span className="text-foreground/70">{new Date(agent.lastActive).toLocaleDateString()}</span></span>
            )}
          </div>
          {agent.violationCount > 0 && (
            <div>
              <span className="text-[10px] font-medium text-[#62627a] uppercase tracking-wider">Violations</span>
              <div className="mt-1">
                {violationsLoading ? (
                  <span className="text-[10px] text-[#62627a]">Loading violations...</span>
                ) : violations && violations.length > 0 ? (
                  <InlineViolationsList violations={violations} />
                ) : (
                  <span className="text-[10px] text-[#62627a]">No violations found.</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SortHeader({ label, sortKey, currentSort, currentDir, onSort }: {
  label: string
  sortKey: SortKey
  currentSort: SortKey
  currentDir: 'asc' | 'desc'
  onSort: (key: SortKey) => void
}) {
  const isActive = currentSort === sortKey
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={cn(
        'text-[10px] font-medium uppercase tracking-wider transition-colors',
        isActive ? 'text-brain-accent' : 'text-[#62627a] hover:text-foreground',
      )}
    >
      {label}
      {isActive && (currentDir === 'asc' ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />)}
    </button>
  )
}

export function AgentMetricsCard() {
  const [sortKey, setSortKey] = useState<SortKey>('totalToolCalls')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [filterAgent, setFilterAgent] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterSession, setFilterSession] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Always fetch unfiltered data — used for deriving filter options and client-side filtering.
  const { data, isLoading } = useQuery({
    queryKey: ['agent-metrics-summary'],
    queryFn: () => api.getAgentMetricsSummary(),
  })

  // Derive filter options from the FULL unfiltered dataset.
  const { agents, projects } = useMemo(() => {
    if (!data) return { agents: [], projects: [] }
    const agentSet = new Set<string>()
    const projectSet = new Set<string>()
    for (const m of data) {
      agentSet.add(m.agent)
      if (m.project) projectSet.add(m.project)
    }
    return { agents: [...agentSet].sort(), projects: [...projectSet].sort() }
  }, [data])

  // Client-side filtering then sorting.
  const filtered = useMemo(() => {
    if (!data) return []
    let list = data
    if (filterAgent) list = list.filter((m) => m.agent === filterAgent)
    if (filterProject) list = list.filter((m) => m.project === filterProject)
    if (filterSession) list = list.filter((m) => m.sessionId?.toLowerCase().includes(filterSession.toLowerCase()))
    return [...list].sort((a, b) => {
      const aVal = sortKey === 'agent' ? a.agent : a[sortKey]
      const bVal = sortKey === 'agent' ? b.agent : b[sortKey]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
  }, [data, filterAgent, filterProject, filterSession, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const hasActiveFilters = !!(filterAgent || filterProject || filterSession)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-4">
        <p className="text-xs text-muted-foreground">Loading agent metrics...</p>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-[#62627a]">No agent metrics available.</p>
    )
  }

  return (
    <div className="space-y-3">
      {/* Sort controls + filter toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-3">
          <SortHeader label="Agent" sortKey="agent" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
          <SortHeader label="Tool calls" sortKey="totalToolCalls" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
          <SortHeader label="Duration" sortKey="totalDurationMs" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
          <SortHeader label="Tokens" sortKey="totalTokens" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
          <SortHeader label="Violations" sortKey="violationCount" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
        </div>
        <Button
          variant="ghost"
          size="xs"
          className="text-[10px] text-[#62627a] shrink-0"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-3 w-3 mr-1" />
          Filter
          {hasActiveFilters && (
            <span className="ml-1 text-brain-accent">*</span>
          )}
        </Button>
      </div>

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
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="h-7 rounded-md bg-brain-surface border border-brain-surface px-2 text-xs text-foreground outline-none focus:border-foreground/20"
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <input
            type="text"
            value={filterSession}
            onChange={(e) => setFilterSession(e.target.value)}
            placeholder="Session ID..."
            className="h-7 w-32 rounded-md bg-brain-surface border border-brain-surface px-2 text-xs text-foreground placeholder:text-[#8585a0] outline-none focus:border-foreground/20"
          />
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="xs"
              className="text-[10px] text-[#62627a]"
              onClick={() => {
                setFilterAgent('')
                setFilterProject('')
                setFilterSession('')
              }}
            >
              Clear
            </Button>
          )}
        </div>
      )}

      {/* Result count when filtered */}
      {hasActiveFilters && (
        <p className="text-[10px] text-[#62627a]">
          Showing {filtered.length} of {data.length} agents.
        </p>
      )}

      {/* Agent cards */}
      <div className="space-y-2">
        {filtered.map((agent) => (
          <AgentMetricRow key={`${agent.agent}-${agent.sessionId ?? ''}`} agent={agent} />
        ))}
      </div>
    </div>
  )
}
