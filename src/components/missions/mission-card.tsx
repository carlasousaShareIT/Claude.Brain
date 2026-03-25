import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MissionProgress } from './mission-progress'
import { MissionTaskRow } from './mission-task-row'
import { cn, timeAgo } from '@/lib/utils'
import { api } from '@/lib/api'
import type { MissionSummary } from '@/lib/types'

interface MissionCardProps {
  mission: MissionSummary
  onComplete: (id: string) => void
  onAbandon: (id: string) => void
  onUpdateTask: (params: {
    missionId: string
    taskId: string
    status?: string
    assignedAgent?: string
    output?: string
    blockers?: string[]
  }) => void
}

export function MissionCard({ mission, onComplete, onAbandon, onUpdateTask }: MissionCardProps) {
  const [copiedId, setCopiedId] = useState(false)
  const isClosed = mission.status === 'completed' || mission.status === 'abandoned'
  const [collapsed, setCollapsed] = useState(isClosed)

  // Fetch full mission with tasks.
  const { data: fullMission } = useQuery({
    queryKey: ['mission', mission.id],
    queryFn: () => api.getMission(mission.id),
  })

  const tasks = fullMission?.tasks ?? []

  const totalTasks = mission.taskCounts.pending + mission.taskCounts.in_progress + mission.taskCounts.completed + mission.taskCounts.blocked
  const completedCount = mission.taskCounts.completed
  const pct = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0

  const handleCopyId = useCallback(async () => {
    await navigator.clipboard.writeText(mission.id)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 1500)
  }, [mission.id])

  const projectColor = useMemo(() => {
    if (!mission.project) return undefined
    let hash = 0
    for (let i = 0; i < mission.project.length; i++) {
      hash = mission.project.charCodeAt(i) + ((hash << 5) - hash)
    }
    return `hsl(${Math.abs(hash) % 360}, 60%, 65%)`
  }, [mission.project])

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
            {!isClosed && (
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
              style={{ backgroundColor: `${projectColor}20`, color: projectColor }}
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

          {/* Task list */}
          {tasks.length > 0 && (
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
          )}
        </CardContent>
      )}
    </Card>
  )
}
