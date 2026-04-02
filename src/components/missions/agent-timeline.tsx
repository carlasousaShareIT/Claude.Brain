import { useMemo, useState } from 'react'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { truncate } from '@/lib/utils'
import type { Task } from '@/lib/types'

const STATUS_COLORS: Record<Task['status'], string> = {
  completed: '#34d399',
  in_progress: '#22d3ee',
  blocked: '#fbbf24',
  pending: '#62627a',
}

const STATUS_LABELS: Record<Task['status'], string> = {
  completed: 'Completed',
  in_progress: 'In progress',
  blocked: 'Blocked',
  pending: 'Pending',
}

interface TimelineTask extends Task {
  _start: number
  _end: number
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

function formatTimeLabel(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`
  return `${(ms / 3_600_000).toFixed(1)}h`
}

interface AgentTimelineProps {
  tasks: Task[]
}

export function AgentTimeline({ tasks }: AgentTimelineProps) {
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null)

  const { timedTasks, lanes, timeRange, stats, ticks } = useMemo(() => {
    // Filter to tasks with time data.
    const timed: TimelineTask[] = tasks
      .filter((t) => t.startedAt)
      .map((t) => ({
        ...t,
        _start: new Date(t.startedAt!).getTime(),
        _end: t.completedAt ? new Date(t.completedAt).getTime() : Date.now(),
      }))

    if (timed.length === 0) return { timedTasks: [], lanes: new Map<string, TimelineTask[]>(), timeRange: { min: 0, max: 0, span: 0 }, stats: null, ticks: [] }

    const min = Math.min(...timed.map((t) => t._start))
    const max = Math.max(...timed.map((t) => t._end))
    const span = max - min || 1

    // Group by agent.
    const laneMap = new Map<string, TimelineTask[]>()
    for (const t of timed) {
      const agent = t.assignedAgent || 'unassigned'
      if (!laneMap.has(agent)) laneMap.set(agent, [])
      laneMap.get(agent)!.push(t)
    }

    // Sort tasks within each lane by start time.
    for (const lane of laneMap.values()) {
      lane.sort((a, b) => a._start - b._start)
    }

    // Compute stats.
    const durations = timed.map((t) => t._end - t._start)
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length

    // Parallelism: max concurrent tasks at any point.
    const events: { time: number; delta: number }[] = []
    for (const t of timed) {
      events.push({ time: t._start, delta: 1 })
      events.push({ time: t._end, delta: -1 })
    }
    events.sort((a, b) => a.time - b.time || a.delta - b.delta)
    let concurrent = 0
    let maxConcurrent = 0
    for (const e of events) {
      concurrent += e.delta
      maxConcurrent = Math.max(maxConcurrent, concurrent)
    }

    // Generate tick marks (4-6 ticks).
    const tickCount = 5
    const tickList: { offset: number; label: string }[] = []
    for (let i = 0; i <= tickCount; i++) {
      const frac = i / tickCount
      tickList.push({ offset: frac * 100, label: formatTimeLabel(frac * span) })
    }

    return {
      timedTasks: timed,
      lanes: laneMap,
      timeRange: { min, max, span },
      stats: {
        totalDuration: span,
        agentCount: laneMap.size,
        avgDuration,
        parallelism: maxConcurrent,
      },
      ticks: tickList,
    }
  }, [tasks])

  if (timedTasks.length === 0) return null

  return (
    <div className="mt-2 space-y-2">
      {/* Summary stats */}
      {stats && (
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-[#62627a]">
          <span>Duration: <span className="text-foreground">{formatDuration(stats.totalDuration)}</span></span>
          <span>Agents: <span className="text-foreground">{stats.agentCount}</span></span>
          <span>Avg task: <span className="text-foreground">{formatDuration(stats.avgDuration)}</span></span>
          <span>Max parallel: <span className="text-foreground">{stats.parallelism}</span></span>
        </div>
      )}

      {/* Timeline */}
      <div className="rounded-md bg-brain-base p-2">
        {/* Time scale */}
        <div className="relative mb-1 h-3">
          {ticks.map((tick, i) => (
            <span
              key={i}
              className="absolute text-[9px] text-[#62627a] -translate-x-1/2"
              style={{ left: `${tick.offset}%` }}
            >
              {tick.label}
            </span>
          ))}
        </div>

        {/* Swim lanes */}
        <TooltipProvider>
          <div className="space-y-1">
            {Array.from(lanes.entries()).map(([agent, laneTasks]) => (
              <div key={agent} className="flex items-center gap-2">
                {/* Agent label */}
                <div className="w-20 shrink-0 truncate text-right text-[10px] text-[#62627a]" title={agent}>
                  {agent}
                </div>
                {/* Bar area */}
                <div className="relative h-5 flex-1 rounded-sm bg-brain-surface">
                  {laneTasks.map((task) => {
                    const left = ((task._start - timeRange.min) / timeRange.span) * 100
                    const width = Math.max(((task._end - task._start) / timeRange.span) * 100, 0.5)
                    const duration = task._end - task._start
                    const color = STATUS_COLORS[task.status]
                    const isHovered = hoveredTaskId === task.id

                    return (
                      <Tooltip key={task.id}>
                        <TooltipTrigger
                          className="absolute top-0.5 bottom-0.5 rounded-[3px] cursor-pointer transition-opacity"
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            minWidth: '4px',
                            backgroundColor: color,
                            opacity: isHovered ? 1 : 0.8,
                          }}
                          onMouseEnter={() => setHoveredTaskId(task.id)}
                          onMouseLeave={() => setHoveredTaskId(null)}
                        />
                        <TooltipContent side="top" className="max-w-xs space-y-1 text-left">
                          <p className="text-xs font-medium">{truncate(task.description, 120)}</p>
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="inline-flex items-center gap-1">
                              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                              {STATUS_LABELS[task.status]}
                            </span>
                            <span>{formatDuration(duration)}</span>
                          </div>
                          {task.output && (
                            <p className="text-[10px] opacity-80">{truncate(task.output, 200)}</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </TooltipProvider>
      </div>
    </div>
  )
}
