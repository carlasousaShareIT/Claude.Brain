import { useResumable } from '@/hooks/use-missions'
import { useUIStore } from '@/stores/ui-store'
import type { ResumableMission } from '@/lib/types'

export function ResumeBanner() {
  const activeProject = useUIStore((s) => s.activeProject)
  const { data } = useResumable(activeProject || undefined)

  const resumable = (data?.missions ?? []).filter(
    (m: ResumableMission) => m.inProgressTasks > 0,
  )

  if (resumable.length === 0) return null

  return (
    <div className="space-y-1.5 px-1">
      {resumable.map((m: ResumableMission) => (
        <div
          key={m.id}
          className="rounded-md border border-brain-accent/30 bg-brain-accent/5 px-3 py-2"
        >
          <p className="text-xs text-brain-accent">
            Resumable: <span className="font-medium text-foreground">{m.name}</span>
            {' '}&mdash; {m.inProgressTasks} task{m.inProgressTasks !== 1 ? 's' : ''} in progress.
          </p>
        </div>
      ))}
    </div>
  )
}
