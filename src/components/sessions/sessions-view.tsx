import { useMemo, useState } from 'react'
import { Calendar, FolderOpen, X } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSessions } from '@/hooks/use-sessions'
import { useProjects } from '@/hooks/use-projects'
import { useUIStore } from '@/stores/ui-store'
import { SessionCard } from './session-card'
import type { SessionSummary } from '@/lib/types'

type DateFilter = 'all' | 'today' | 'week' | 'month'

const DATE_FILTERS: { key: DateFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
]

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return startOfDay(d)
}

function matchesDateFilter(session: SessionSummary, filter: DateFilter): boolean {
  if (filter === 'all') return true
  const ts = session.startedAt || session.latest || session.earliest
  if (!ts) return false
  const date = new Date(ts)
  if (filter === 'today') return date >= startOfDay(new Date())
  if (filter === 'week') return date >= daysAgo(7)
  if (filter === 'month') return date >= daysAgo(30)
  return true
}

function matchesProjectFilter(session: SessionSummary, projectId: string): boolean {
  if (!projectId) return true
  return (session.projects ?? []).includes(projectId)
}

export function SessionsView() {
  const { data: sessions, isLoading } = useSessions()
  const { data: projects } = useProjects()
  const sessionFilterId = useUIStore((s) => s.sessionFilterId)
  const setSessionFilterId = useUIStore((s) => s.setSessionFilterId)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [projectFilter, setProjectFilter] = useState('')

  const activeSession = sessions?.find((s) => s.id === sessionFilterId)

  const filteredSessions = useMemo(() => {
    if (!sessions) return []
    return sessions.filter(
      (s) => matchesDateFilter(s, dateFilter) && matchesProjectFilter(s, projectFilter),
    )
  }, [sessions, dateFilter, projectFilter])

  const activeProjects = useMemo(() => {
    if (!projects) return []
    return projects.filter((p) => p.status === 'active')
  }, [projects])

  const hasActiveFilters = dateFilter !== 'all' || projectFilter !== ''

  const handleFilter = (id: string) => {
    setSessionFilterId(id === sessionFilterId ? '' : id)
  }

  const handleToggleExpand = (id: string) => {
    setExpandedId(id === expandedId ? null : id)
  }

  const handleClearFilters = () => {
    setDateFilter('all')
    setProjectFilter('')
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-[#62627a]">Loading sessions...</p>
      </div>
    )
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-[#62627a]">No sessions found.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Filter bar */}
      <div className="shrink-0 space-y-2 border-b border-white/5 px-4 py-3">
        {/* Date filters */}
        <div className="flex items-center gap-2">
          <Calendar className="h-3 w-3 text-[#62627a]" />
          <div className="flex gap-1">
            {DATE_FILTERS.map((f) => (
              <Button
                key={f.key}
                variant="ghost"
                size="xs"
                className={cn(
                  'h-6 px-2 text-[11px] text-[#62627a] hover:text-foreground',
                  dateFilter === f.key && 'bg-brain-surface text-foreground',
                )}
                onClick={() => setDateFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Project filter */}
        <div className="flex items-center gap-2">
          <FolderOpen className="h-3 w-3 text-[#62627a]" />
          <div className="flex flex-wrap gap-1">
            <Button
              variant="ghost"
              size="xs"
              className={cn(
                'h-6 px-2 text-[11px] text-[#62627a] hover:text-foreground',
                !projectFilter && 'bg-brain-surface text-foreground',
              )}
              onClick={() => setProjectFilter('')}
            >
              All
            </Button>
            {activeProjects.map((p) => (
              <Button
                key={p.id}
                variant="ghost"
                size="xs"
                className={cn(
                  'h-6 px-2 text-[11px] text-[#62627a] hover:text-foreground',
                  projectFilter === p.id && 'bg-brain-surface text-foreground',
                )}
                onClick={() => setProjectFilter(p.id)}
              >
                {p.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Result count + clear */}
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-[#62627a]">
            {filteredSessions.length} of {sessions.length} sessions
          </p>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="xs"
              className="h-5 gap-1 px-1.5 text-[10px] text-[#62627a] hover:text-foreground"
              onClick={handleClearFilters}
            >
              <X className="h-2.5 w-2.5" />
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Sidebar filter indicator */}
      {sessionFilterId && activeSession && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/5 bg-brain-raised/50 px-4 py-2">
          <p className="text-xs text-muted-foreground">
            Filtering sidebar to session:{' '}
            <span className="font-medium text-foreground">
              {activeSession.label ?? activeSession.id.slice(0, 12)}
            </span>
          </p>
          <Button
            variant="ghost"
            size="xs"
            className="h-5 w-5 p-0 text-[#62627a] hover:text-foreground"
            onClick={() => setSessionFilterId('')}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <ScrollArea className="flex-1 min-h-0 overflow-hidden">
        <div className="space-y-2 p-4">
          {filteredSessions.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#62627a]">
              No sessions match the current filters.
            </p>
          ) : (
            filteredSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onFilter={handleFilter}
                isFiltered={session.id === sessionFilterId}
                isExpanded={session.id === expandedId}
                onToggleExpand={handleToggleExpand}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
