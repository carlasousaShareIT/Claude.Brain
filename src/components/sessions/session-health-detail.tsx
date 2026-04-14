import { useSessionHealth } from '@/hooks/use-session-health'
import { Badge } from '@/components/ui/badge'
import { timeAgo } from '@/lib/utils'

const ACTIVITY_COLORS: Record<string, string> = {
  brain_query: '#60a5fa',
  brain_write: '#34d399',
  profile_inject: '#a78bfa',
  reviewer_run: '#fbbf24',
  agent_spawn: '#f472b6',
  commit: '#f87171',
}

const ACTIVITY_LABELS: Record<string, string> = {
  brain_query: 'Brain query',
  brain_write: 'Brain write',
  profile_inject: 'Profile inject',
  reviewer_run: 'Reviewer',
  agent_spawn: 'Agent spawn',
  commit: 'Commit',
}

function gateColor(status: string): string {
  if (status === 'pass') return '#34d399'
  if (status === 'fail') return '#f87171'
  return '#62627a'
}

function gateBg(status: string): string {
  if (status === 'pass') return '#34d39920'
  if (status === 'fail') return '#f8717120'
  return '#62627a15'
}

const GATE_LABELS: Record<string, string> = {
  brain_query_gate: 'Brain query',
  agent_profile_gate: 'Agent context',
  reviewer_gate: 'Reviewer',
}

export function SessionHealthDetail({ sessionId }: { sessionId: string }) {
  const { data, isLoading } = useSessionHealth(sessionId)

  if (isLoading) {
    return (
      <div className="px-3 pb-2 pt-1">
        <p className="text-[10px] text-[#62627a]">Loading health...</p>
      </div>
    )
  }

  if (!data) return null

  const gateEntries = Object.entries(data.gates)
  const activityEntries = Object.entries(data.activityCounts).filter(
    ([, count]) => count > 0,
  )

  return (
    <div className="border-t border-white/5 px-3 pb-3 pt-2 space-y-2.5">
      {/* Gate pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-[#62627a] mr-0.5">Gates:</span>
        {gateEntries.map(([gate, status]) => (
          <Badge
            key={gate}
            variant="secondary"
            className="text-[10px] border-0"
            style={{
              backgroundColor: gateBg(status),
              color: gateColor(status),
            }}
          >
            {GATE_LABELS[gate] ?? gate}: {status === 'not_applicable' ? 'n/a' : status}
          </Badge>
        ))}
      </div>

      {/* Activity counts */}
      {activityEntries.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <span className="text-[#62627a]">Activities:</span>
          {activityEntries.map(([type, count]) => (
            <span key={type} className="flex items-center gap-1">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: ACTIVITY_COLORS[type] ?? '#9d9db5' }}
              />
              <span className="text-muted-foreground">
                {ACTIVITY_LABELS[type] ?? type}
              </span>
              <span className="tabular-nums font-medium text-foreground">{count}</span>
            </span>
          ))}
        </div>
      )}

      {/* Gaps */}
      {data.gaps.length > 0 && (
        <div className="space-y-0.5">
          {data.gaps.map((gap, i) => (
            <p key={i} className="text-[10px] leading-tight" style={{ color: '#fbbf24' }}>
              {gap}
            </p>
          ))}
        </div>
      )}

      {/* Timeline */}
      {data.timeline.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-[10px] uppercase tracking-wider text-[#62627a] mb-1">
            Activity timeline
          </p>
          {data.timeline.map((event, i) => {
            const dotColor = ACTIVITY_COLORS[event.type] ?? '#9d9db5'
            return (
              <div
                key={i}
                className="flex items-baseline gap-2 rounded px-1.5 py-0.5 hover:bg-brain-hover/50"
              >
                <span
                  className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: dotColor }}
                />
                <span
                  className="shrink-0 text-[10px] font-medium"
                  style={{ color: dotColor }}
                >
                  {ACTIVITY_LABELS[event.type] ?? event.type}
                </span>
                {event.details && (
                  <span className="text-xs text-foreground/70 leading-snug truncate">
                    {event.details.length > 80
                      ? event.details.slice(0, 80) + '...'
                      : event.details}
                  </span>
                )}
                <span className="ml-auto shrink-0 text-[10px] text-[#62627a]">
                  {timeAgo(event.timestamp)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
