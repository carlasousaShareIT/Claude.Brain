import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { AgentMetricsSummary } from '@/lib/types'

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

function AgentMetricRow({ agent }: { agent: AgentMetricsSummary }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-md bg-brain-base p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-sm font-semibold text-foreground truncate">{agent.agent}</span>
          {agent.violationCount > 0 && (
            <Badge variant="outline" className="text-[9px] text-brain-red border-brain-red/30">
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
        <span className="text-[10px] text-[#62627a]">
          <span className="text-foreground/70 font-medium">{agent.taskCount}</span> tasks
        </span>
        <span className="text-[10px] text-[#62627a]">
          <span className="text-foreground/70 font-medium">{agent.completedCount}</span> completed
        </span>
        <span className="text-[10px] text-[#62627a]">
          <span className="text-foreground/70 font-medium">{agent.totalToolCalls}</span> tool calls
        </span>
        <span className="text-[10px] text-[#62627a]">
          avg <span className="text-foreground/70 font-medium">{formatDuration(agent.avgDurationMs)}</span>
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

  const { data, isLoading } = useQuery({
    queryKey: ['agent-metrics-summary'],
    queryFn: api.getAgentMetricsSummary,
  })

  const sorted = useMemo(() => {
    if (!data) return []
    return [...data].sort((a, b) => {
      const aVal = sortKey === 'agent' ? a.agent : a[sortKey]
      const bVal = sortKey === 'agent' ? b.agent : b[sortKey]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
  }, [data, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

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
      {/* Sort controls */}
      <div className="flex flex-wrap gap-3">
        <SortHeader label="Agent" sortKey="agent" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
        <SortHeader label="Tool calls" sortKey="totalToolCalls" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
        <SortHeader label="Duration" sortKey="totalDurationMs" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
        <SortHeader label="Tokens" sortKey="totalTokens" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
        <SortHeader label="Violations" sortKey="violationCount" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
        <SortHeader label="Tasks" sortKey="taskCount" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
      </div>

      {/* Agent cards */}
      <div className="space-y-2">
        {sorted.map((agent) => (
          <AgentMetricRow key={agent.agent} agent={agent} />
        ))}
      </div>
    </div>
  )
}
