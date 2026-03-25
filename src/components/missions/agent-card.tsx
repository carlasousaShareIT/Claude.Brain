import { useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { cn, timeAgo, truncate } from '@/lib/utils'
import { TASK_STATUS_ICONS } from '@/lib/constants'
import type { AgentSummary } from '@/lib/types'

interface AgentCardProps {
  agent: AgentSummary
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '—'
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
}

export function AgentCard({ agent }: AgentCardProps) {
  const [expanded, setExpanded] = useState(false)

  const successRate =
    agent.taskCount > 0
      ? Math.round((agent.completedCount / agent.taskCount) * 100)
      : 0

  return (
    <div className="bg-brain-base rounded-md p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold text-foreground truncate">{agent.name}</span>
          {agent.lastUsed && (
            <span className="text-[10px] text-[#62627a]">{timeAgo(agent.lastUsed)}</span>
          )}
        </div>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="shrink-0 text-[#62627a] hover:text-foreground transition-colors"
          aria-label={expanded ? 'Collapse task history' : 'Expand task history'}
        >
          {expanded
            ? <ChevronDown className="h-3.5 w-3.5" />
            : <ChevronRight className="h-3.5 w-3.5" />
          }
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[10px] text-[#62627a]">
          <span className="text-foreground/70 font-medium">{agent.taskCount}</span> tasks
        </span>
        <span className="text-[10px] text-[#62627a]">
          <span className="text-foreground/70 font-medium">{successRate}%</span> success
        </span>
        <span className="text-[10px] text-[#62627a]">
          avg <span className="text-foreground/70 font-medium">{formatDuration(agent.avgDurationMs)}</span>
        </span>
        {agent.blockedCount > 0 && (
          <span className="text-[10px] text-brain-red">
            {agent.blockedCount} blocked
          </span>
        )}
      </div>

      {expanded && agent.recentTasks.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-white/5 pt-2">
          {agent.recentTasks.map((task) => {
            const icon = TASK_STATUS_ICONS[task.status] ?? TASK_STATUS_ICONS.pending
            return (
              <div key={task.id} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'shrink-0 text-[10px] font-mono',
                      task.status === 'completed' && 'text-brain-green',
                      task.status === 'blocked' && 'text-brain-red',
                      task.status === 'in_progress' && 'text-brain-blue',
                      task.status === 'pending' && 'text-[#62627a]',
                    )}
                  >
                    {icon.icon}
                  </span>
                  <span className="text-xs text-foreground/80">
                    {truncate(task.description, 60)}
                  </span>
                </div>
                {task.output && (
                  <span className="pl-4 text-[10px] text-[#62627a]">{task.output}</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
