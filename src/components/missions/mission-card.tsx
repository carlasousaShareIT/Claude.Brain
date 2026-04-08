import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MissionProgress } from './mission-progress'
import { MissionTaskRow } from './mission-task-row'
import { AgentTimeline } from './agent-timeline'
import { cn, timeAgo, projectColor } from '@/lib/utils'
import { api } from '@/lib/api'
import type { MissionSummary, Task } from '@/lib/types'

interface MissionCardProps {
  mission: MissionSummary
  onComplete: (id: string) => void
  onAbandon: (id: string) => void
  onReopen: (id: string) => void
  onUpdateTask: (params: {
    missionId: string
    taskId: string
    status?: string
    assignedAgent?: string
    output?: string
    blockers?: string[]
  }) => void
}

function PhaseSection({
  label,
  tasks,
  missionId,
  onUpdateTask,
}: {
  label: string
  tasks: Task[]
  missionId: string
  onUpdateTask: MissionCardProps['onUpdateTask']
}) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div>
      <button
        className="flex items-center gap-1 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#62627a] hover:text-muted-foreground"
        onClick={() => setCollapsed((c) => !c)}
      >
        {collapsed ? <ChevronRight className="size-2.5" /> : <ChevronDown className="size-2.5" />}
        {label}
        <span className="font-normal">({tasks.length})</span>
      </button>
      {!collapsed && (
        <div className="space-y-0.5 pl-1">
          {tasks.map((task) => (
            <MissionTaskRow
              key={task.id}
              task={task}
              missionId={missionId}
              onUpdateTask={onUpdateTask}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function MissionCard({ mission, onComplete, onAbandon, onReopen, onUpdateTask }: MissionCardProps) {
  const [copiedId, setCopiedId] = useState(false)
  const isClosed = mission.status === 'completed' || mission.status === 'abandoned'
  const hasActiveWork = mission.taskCounts.in_progress > 0
  const [collapsed, setCollapsed] = useState(!hasActiveWork)

  // Fetch full mission with tasks.
  const { data: fullMission } = useQuery({
    queryKey: ['mission', mission.id],
    queryFn: () => api.getMission(mission.id),
  })

  const tasks = fullMission?.tasks ?? []

  // Group tasks by phase for sectioned rendering.
  const phaseGroups = useMemo(() => {
    const groups = new Map<string, Task[]>()
    for (const task of tasks) {
      const key = task.phase || ''
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(task)
    }
    // Sort: named phases alphabetically, ungrouped (empty key) last.
    const sorted: { phase: string; label: string; tasks: Task[] }[] = []
    const keys = [...groups.keys()].sort((a, b) => {
      if (a === '') return 1
      if (b === '') return -1
      return a.localeCompare(b)
    })
    for (const key of keys) {
      sorted.push({ phase: key, label: key || 'Ungrouped', tasks: groups.get(key)! })
    }
    return sorted
  }, [tasks])

  const hasPhases = phaseGroups.length > 1 || (phaseGroups.length === 1 && phaseGroups[0].phase !== '')

  const totalTasks = mission.taskCounts.pending + mission.taskCounts.in_progress + mission.taskCounts.completed + mission.taskCounts.blocked + (mission.taskCounts.interrupted || 0)
  const completedCount = mission.taskCounts.completed
  const pct = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0

  const handleCopyId = useCallback(async () => {
    await navigator.clipboard.writeText(mission.id)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 1500)
  }, [mission.id])

  const missionColor = mission.project ? projectColor(mission.project) : undefined

  return (
    <Card
      className={cn(
        'border-0 bg-brain-raised ring-1 ring-white/5 transition-opacity',
        isClosed && 'opacity-50',
      )}
    >
      <CardHeader className="pb-0">
        <div className="group/header flex items-start justify-between gap-2">
          <button
            className="flex min-w-0 flex-1 items-start gap-1.5 text-left"
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed
              ? <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#62627a]" />
              : <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#62627a]" />
            }
            <h3 className="text-sm font-semibold text-foreground leading-snug">
              {mission.name}
            </h3>
          </button>
          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover/header:opacity-100">
            {!isClosed ? (
              <>
                <Button
                  variant="ghost"
                  size="xs"
                  className="text-brain-green"
                  onClick={() => onComplete(mission.id)}
                >
                  Complete
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  className="text-brain-red"
                  onClick={() => onAbandon(mission.id)}
                >
                  Abandon
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="xs"
                className="text-brain-accent"
                onClick={() => onReopen(mission.id)}
              >
                Reopen
              </Button>
            )}
          </div>
        </div>

        {/* Subtitle row */}
        <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-5">
          <button onClick={handleCopyId} className="cursor-pointer">
            <Badge variant="secondary" className="font-mono text-[10px] bg-brain-base text-[#62627a] hover:text-muted-foreground">
              {copiedId ? 'copied!' : mission.id.slice(0, 8)}
            </Badge>
          </button>
          {mission.project && (
            <Badge
              variant="secondary"
              className="text-[10px]"
              style={{ backgroundColor: `${missionColor}20`, color: missionColor }}
            >
              {mission.project}
            </Badge>
          )}
          <span className="text-[10px] text-[#62627a]">
            {completedCount}/{totalTasks} tasks complete
          </span>
          <span className="text-[10px] text-[#62627a]">
            {timeAgo(mission.createdAt)}
          </span>
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent className="space-y-2">
          {/* Progress bar + percentage */}
          <div className="space-y-1">
            <MissionProgress tasks={tasks} />
            <p className="text-[10px] tabular-nums text-muted-foreground">{pct}%</p>
          </div>

          {/* Task list — grouped by phase when phases exist */}
          {tasks.length > 0 && (
            hasPhases ? (
              <div className="space-y-2">
                {phaseGroups.map((group) => (
                  <PhaseSection
                    key={group.phase}
                    label={group.label}
                    tasks={group.tasks}
                    missionId={mission.id}
                    onUpdateTask={onUpdateTask}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-0.5">
                {tasks.map((task) => (
                  <MissionTaskRow
                    key={task.id}
                    task={task}
                    missionId={mission.id}
                    onUpdateTask={onUpdateTask}
                  />
                ))}
              </div>
            )
          )}

          {/* Agent execution timeline */}
          <AgentTimeline tasks={tasks} />
        </CardContent>
      )}
    </Card>
  )
}
