import { useMemo } from 'react'
import { truncate } from '@/lib/utils'
import type { Task } from '@/lib/types'

const STATUS_COLORS: Record<Task['status'], string> = {
  completed: '#34d399',
  in_progress: '#22d3ee',
  blocked: '#fbbf24',
  pending: '#62627a',
}

const STATUS_ICONS: Record<Task['status'], string> = {
  completed: '✓',
  in_progress: '▶',
  blocked: '!',
  pending: '○',
}

function formatDuration(ms: number): string {
  if (ms < 1000) return '<1s'
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface AgentGroup {
  agent: string
  tasks: Array<Task & { _duration: number }>
  totalDuration: number
  completedCount: number
}

interface AgentTimelineProps {
  tasks: Task[]
}

export function AgentTimeline({ tasks }: AgentTimelineProps) {
  const { groups, stats } = useMemo(() => {
    const timed = tasks
      .filter((t) => t.startedAt)
      .map((t) => {
        const start = new Date(t.startedAt!).getTime()
        const end = t.completedAt ? new Date(t.completedAt).getTime() : Date.now()
        return { ...t, _duration: end - start }
      })
      .sort((a, b) => new Date(a.startedAt!).getTime() - new Date(b.startedAt!).getTime())

    if (timed.length === 0) return { groups: [], stats: null }

    // Group by agent.
    const agentMap = new Map<string, typeof timed>()
    for (const t of timed) {
      const agent = t.assignedAgent || 'unassigned'
      if (!agentMap.has(agent)) agentMap.set(agent, [])
      agentMap.get(agent)!.push(t)
    }

    const agentGroups: AgentGroup[] = Array.from(agentMap.entries()).map(([agent, agentTasks]) => ({
      agent,
      tasks: agentTasks,
      totalDuration: agentTasks.reduce((sum, t) => sum + t._duration, 0),
      completedCount: agentTasks.filter((t) => t.status === 'completed').length,
    }))

    // Sort agents: most tasks first.
    agentGroups.sort((a, b) => b.tasks.length - a.tasks.length)

    // Find the longest agent duration for the bar scale.
    const maxDuration = Math.max(...agentGroups.map((g) => g.totalDuration), 1)

    // Parallelism.
    const events: { time: number; delta: number }[] = []
    for (const t of timed) {
      events.push({ time: new Date(t.startedAt!).getTime(), delta: 1 })
      const end = t.completedAt ? new Date(t.completedAt).getTime() : Date.now()
      events.push({ time: end, delta: -1 })
    }
    events.sort((a, b) => a.time - b.time || a.delta - b.delta)
    let concurrent = 0
    let maxConcurrent = 0
    for (const e of events) {
      concurrent += e.delta
      maxConcurrent = Math.max(maxConcurrent, concurrent)
    }

    const durations = timed.map((t) => t._duration)
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length
    const wallClock = Math.max(...timed.map((t) => (t.completedAt ? new Date(t.completedAt).getTime() : Date.now()))) -
      Math.min(...timed.map((t) => new Date(t.startedAt!).getTime()))

    return {
      groups: agentGroups,
      stats: {
        wallClock,
        agentCount: agentGroups.length,
        taskCount: timed.length,
        avgDuration,
        parallelism: maxConcurrent,
        maxDuration,
      },
    }
  }, [tasks])

  if (groups.length === 0) return null

  return (
    <div className="mt-3 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-[#8585a0]">
          Agent activity
        </span>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-[#8585a0]">
          <span>{stats.taskCount} tasks across <span className="text-foreground tabular-nums">{stats.agentCount}</span> agents</span>
          <span>Avg <span className="text-foreground tabular-nums">{formatDuration(stats.avgDuration)}</span></span>
          <span>Peak <span className="text-foreground tabular-nums">{stats.parallelism}</span> parallel</span>
        </div>
      )}

      {/* Agent groups */}
      <div className="space-y-2">
        {groups.map((group) => (
          <div key={group.agent} className="rounded-md bg-brain-base p-2.5">
            {/* Agent header */}
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-foreground/80 truncate">{group.agent}</span>
              <div className="flex items-center gap-2 shrink-0 text-[10px] text-[#8585a0]">
                <span className="tabular-nums">{group.completedCount}/{group.tasks.length} done</span>
                <span className="tabular-nums">{formatDuration(group.totalDuration)}</span>
              </div>
            </div>

            {/* Duration bar — proportional to this agent's total vs the max. */}
            {stats && (
              <div className="h-1.5 rounded-full bg-brain-surface mb-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max((group.totalDuration / stats.maxDuration) * 100, 2)}%`,
                    backgroundColor: group.completedCount === group.tasks.length ? '#34d399' : '#22d3ee',
                  }}
                />
              </div>
            )}

            {/* Task list */}
            <div className="space-y-1">
              {group.tasks.map((task) => {
                const color = STATUS_COLORS[task.status]
                const icon = STATUS_ICONS[task.status]
                return (
                  <div key={task.id} className="flex items-start gap-2 text-[11px]">
                    {/* Status icon */}
                    <span
                      className="shrink-0 w-4 text-center text-[10px] font-medium mt-px"
                      style={{ color }}
                    >
                      {icon}
                    </span>
                    {/* Description */}
                    <span className="flex-1 min-w-0 text-foreground/70 leading-snug">
                      {truncate(task.description, 80)}
                    </span>
                    {/* Time + duration */}
                    <div className="shrink-0 flex items-center gap-1.5 text-[10px] text-[#8585a0] tabular-nums">
                      <span>{formatTime(task.startedAt!)}</span>
                      <span className="text-foreground/50">→</span>
                      <span>{task.completedAt ? formatTime(task.completedAt) : 'now'}</span>
                      <span
                        className="rounded px-1 py-px font-medium"
                        style={{ backgroundColor: `${color}20`, color }}
                      >
                        {formatDuration(task._duration)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
