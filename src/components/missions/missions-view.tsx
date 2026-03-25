import { useCallback, useState } from 'react'
import { useMissions } from '@/hooks/use-missions'
import { useUIStore } from '@/stores/ui-store'
import { MissionsToolbar } from './missions-toolbar'
import { ResumeBanner } from './resume-banner'
import { MissionCard } from './mission-card'
import type { MissionSummary } from '@/lib/types'

export function MissionsView() {
  const activeProject = useUIStore((s) => s.activeProject)
  const [showCompleted, setShowCompleted] = useState(false)

  const {
    data: activeMissions,
    updateMission,
    updateTask,
  } = useMissions('active', activeProject || undefined)

  // Always pass 'completed' status so the query key is stable.
  // Data is only used when showCompleted is true.
  const { data: completedMissions } = useMissions(
    'completed',
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

  const allMissions: MissionSummary[] = [
    ...(activeMissions ?? []),
    ...(showCompleted ? (completedMissions ?? []) : []),
  ]

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4">
        <MissionsToolbar showCompleted={showCompleted} onToggle={setShowCompleted} />
      </div>

      <div className="flex-1 overflow-y-auto px-4">
        <div className="space-y-3 pb-4">
          <ResumeBanner />

          {allMissions.length === 0 && (
            <p className="py-8 text-center text-xs text-[#62627a]">No missions found.</p>
          )}

          {allMissions.map((mission) => (
            <MissionCard
              key={mission.id}
              mission={mission}
              onComplete={handleComplete}
              onAbandon={handleAbandon}
              onUpdateTask={handleUpdateTask}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
