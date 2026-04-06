import { useActivityStore } from '@/stores/activity-store'
import type { ActivityEvent } from '@/stores/activity-store'

const STATUS_COLORS: Record<string, string> = {
  in_progress: '#22d3ee',
  completed: '#34d399',
  blocked: '#fbbf24',
  pending: '#62627a',
}

function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? '#62627a'
}

function EventChip({ event }: { event: ActivityEvent }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-foreground/80">
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: statusColor(event.status) }}
      />
      <span className="font-medium">{event.agent ?? 'unknown'}</span>
      <span className="text-foreground/50">&rarr;</span>
      <span className="max-w-[200px] truncate">{event.taskDescription}</span>
      <span className="text-[10px] text-foreground/40">({event.status})</span>
    </span>
  )
}

export function LiveActivityBar() {
  const events = useActivityStore((s) => s.events)
  const activeAgents = useActivityStore((s) => s.activeAgents)

  if (activeAgents.length === 0) return null

  return (
    <div className="flex h-8 items-center gap-3 rounded-md border border-brain-cyan/20 bg-brain-raised px-3">
      {/* Live indicator */}
      <span className="flex shrink-0 items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
          Live
        </span>
      </span>

      {/* Scrolling event feed */}
      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto">
        {events.slice(0, 10).map((event) => (
          <EventChip key={event.id} event={event} />
        ))}
      </div>

      {/* Active agent count */}
      <span className="shrink-0 text-[10px] text-foreground/50">
        {activeAgents.length} active agent{activeAgents.length !== 1 ? 's' : ''}
      </span>
    </div>
  )
}
