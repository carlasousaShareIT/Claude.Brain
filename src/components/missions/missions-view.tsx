import { useCallback } from 'react'
import { useMissions } from '@/hooks/use-missions'
import { useUIStore } from '@/stores/ui-store'
import { QueryError } from '@/components/ui/query-error'
import { ResumeBanner } from './resume-banner'
import { LiveActivityBar } from './live-activity-bar'
import { MissionCard } from './mission-card'
import { AgentsPanel } from './agents-panel'
import type { MissionSummary } from '@/lib/types'

export function MissionsView() {
  const activeProject = useUIStore((s) => s.activeProject)

  const {
    data: activeMissions,
    isLoading,
    isError,
    refetch,
    updateMission,
    updateTask,
  } = useMissions('active', activeProject || undefined)

  const { data: completedMissions } = useMissions(
    'completed',
    activeProject || undefined,
  )

  const { data: abandonedMissions } = useMissions(
    'abandoned',
    activeProject || undefined,
  )

  const handleComplete = useCallback(
    (id: string) => updateMission.mutate({ id, status: 'completed' }),
    [updateMission],
  )

  const handleAbandon = useCallback(
    (id: string) => updateMission.mutate({ id, status: 'abandoned' }),
    [updateMission],
  )

  const handleReopen = useCallback(
    (id: string) => updateMission.mutate({ id, status: 'active' }),
    [updateMission],
  )

  const handleUpdateTask = useCallback(
    (params: {
      missionId: string
      taskId: string
      status?: string
      assignedAgent?: string
      output?: string
      blockers?: string[]
    }) => updateTask.mutate(params),
    [updateTask],
  )

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading missions...</p>
      </div>
    )
  }

  if (isError) {
    return <QueryError message="Failed to load missions." onRetry={refetch} />
  }

  const active: MissionSummary[] = activeMissions ?? []
  const closed: MissionSummary[] = [
    ...(completedMissions ?? []),
    ...(abandonedMissions ?? []),
  ]

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4">
        <div className="space-y-3 pt-4 pb-4">
          <ResumeBanner />
          <LiveActivityBar />

          {active.length === 0 && closed.length === 0 && (
            <p className="py-8 text-center text-xs text-[#62627a]">No missions found.</p>
          )}

          {active.map((mission) => (
            <MissionCard
              key={mission.id}
              mission={mission}
              onComplete={handleComplete}
              onAbandon={handleAbandon}
              onReopen={handleReopen}
              onUpdateTask={handleUpdateTask}
            />
          ))}

          {closed.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 pt-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-[#62627a]">
                  Closed
                </span>
                <span className="text-[10px] text-[#62627a]">({closed.length})</span>
              </div>
              {closed.map((mission) => (
                <MissionCard
                  key={mission.id}
                  mission={mission}
                  onComplete={handleComplete}
                  onAbandon={handleAbandon}
                  onReopen={handleReopen}
                  onUpdateTask={handleUpdateTask}
                />
              ))}
            </div>
          )}
        </div>

        <AgentsPanel />
      </div>
    </div>
  )
}
