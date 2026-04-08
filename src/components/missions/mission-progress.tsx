import { useMemo } from 'react'
import type { Task } from '@/lib/types'

interface MissionProgressProps {
  tasks: Task[]
}

export function MissionProgress({ tasks }: MissionProgressProps) {
  const segments = useMemo(() => {
    const total = tasks.length
    if (total === 0) return { completed: 0, inProgress: 0, blocked: 0, interrupted: 0, pending: 100 }

    return {
      completed: (tasks.filter((t) => t.status === 'completed').length / total) * 100,
      inProgress: (tasks.filter((t) => t.status === 'in_progress').length / total) * 100,
      blocked: (tasks.filter((t) => t.status === 'blocked').length / total) * 100,
      interrupted: (tasks.filter((t) => t.status === 'interrupted').length / total) * 100,
      pending: (tasks.filter((t) => t.status === 'pending').length / total) * 100,
    }
  }, [tasks])

  return (
    <div className="flex h-1 w-full overflow-hidden rounded-full">
      {segments.completed > 0 && (
        <div
          className="bg-brain-green transition-all"
          style={{ width: `${segments.completed}%` }}
        />
      )}
      {segments.inProgress > 0 && (
        <div
          className="bg-brain-accent transition-all"
          style={{ width: `${segments.inProgress}%` }}
        />
      )}
      {segments.blocked > 0 && (
        <div
          className="bg-brain-amber transition-all"
          style={{ width: `${segments.blocked}%` }}
        />
      )}
      {segments.interrupted > 0 && (
        <div
          className="bg-brain-amber/60 transition-all"
          style={{ width: `${segments.interrupted}%` }}
        />
      )}
      {segments.pending > 0 && (
        <div
          className="bg-brain-hover transition-all"
          style={{ width: `${segments.pending}%` }}
        />
      )}
    </div>
  )
}
