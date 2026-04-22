import { useCallback, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, RotateCcw, Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TASK_STATUS_ICONS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import type { Task } from '@/lib/types'

const STATUS_BORDER_COLOR: Record<string, string> = {
  pending: 'border-l-[#9d9db5]',
  in_progress: 'border-l-brain-accent',
  reviewed: 'border-l-brain-cyan',
  completed: 'border-l-brain-green',
  blocked: 'border-l-brain-amber',
  interrupted: 'border-l-brain-amber',
  verification_failed: 'border-l-brain-red',
}

const STATUS_TEXT_COLOR: Record<string, string> = {
  pending: 'text-muted-foreground',
  in_progress: 'text-brain-accent',
  reviewed: 'text-brain-cyan',
  completed: 'text-brain-green',
  blocked: 'text-brain-amber',
  interrupted: 'text-brain-amber',
  verification_failed: 'text-brain-red',
}

interface MissionTaskRowProps {
  task: Task
  missionId: string
  onUpdateTask: (params: {
    missionId: string
    taskId: string
    status?: string
    assignedAgent?: string
    output?: string
    blockers?: string[]
  }) => void
}

export function MissionTaskRow({ task, missionId, onUpdateTask }: MissionTaskRowProps) {
  const [showOutput, setShowOutput] = useState(false)
  const [showVerification, setShowVerification] = useState(false)
  const [copied, setCopied] = useState(false)
  const statusMeta = TASK_STATUS_ICONS[task.status]
  const queryClient = useQueryClient()

  const retryMutation = useMutation({
    mutationFn: () => api.retryTask(missionId, task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missions'] })
      queryClient.invalidateQueries({ queryKey: ['mission', missionId] })
    },
  })

  const handleCopyId = useCallback(async () => {
    await navigator.clipboard.writeText(task.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [task.id])

  const handleStatusChange = useCallback(
    (newStatus: string) => {
      onUpdateTask({ missionId, taskId: task.id, status: newStatus })
    },
    [missionId, task.id, onUpdateTask],
  )

  return (
    <div className="group/task" id={`task-${task.id}`}>
      <div
        className={cn(
          'flex items-start gap-2 rounded-md border-l-2 py-1.5 pl-2.5 pr-1.5 transition-colors',
          'hover:bg-brain-hover/50',
          'target:ring-1 target:ring-brain-accent/40 target:bg-brain-hover/30',
          STATUS_BORDER_COLOR[task.status],
        )}
      >
        {/* Status icon */}
        <span
          className={cn(
            'mt-0.5 shrink-0 text-xs leading-none',
            STATUS_TEXT_COLOR[task.status],
            task.status === 'in_progress' && 'animate-pulse',
          )}
        >
          {statusMeta?.icon}
        </span>

        {/* Task info */}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground leading-snug">
            {task.title || task.description}
          </p>
          {task.title && (
            <p className="mt-0.5 text-[11px] text-foreground/60 leading-snug line-clamp-2">
              {task.description}
            </p>
          )}
          <button
            onClick={handleCopyId}
            className="mt-0.5 cursor-pointer"
          >
            <Badge variant="secondary" className="font-mono text-[10px] bg-brain-base text-[#62627a] hover:text-muted-foreground">
              {copied ? 'copied!' : task.id.slice(0, 8)}
            </Badge>
          </button>
        </div>

        {/* Agent tag */}
        {task.assignedAgent && (
          <Badge variant="outline" className="shrink-0 text-[10px] text-brain-accent border-brain-accent/30">
            {task.assignedAgent}
          </Badge>
        )}

        {/* Verification command badge */}
        {task.verificationCommand && (
          <Badge variant="outline" className="shrink-0 text-[10px] text-[#62627a] border-[#62627a]/30 gap-0.5">
            <Terminal className="h-2.5 w-2.5" />
            verified
          </Badge>
        )}

        {/* Verification result toggle */}
        {task.verificationResult && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setShowVerification((prev) => !prev)}
            className={cn(
              'shrink-0',
              task.verificationResult.exitCode === 0 ? 'text-brain-green' : 'text-brain-red',
            )}
          >
            {showVerification ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          </Button>
        )}

        {/* Output toggle */}
        {task.output && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setShowOutput((prev) => !prev)}
            className="shrink-0 text-muted-foreground"
          >
            {showOutput ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          </Button>
        )}

        {/* Action buttons — visible on hover */}
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/task:opacity-100">
          {task.status === 'pending' && (
            <Button variant="ghost" size="xs" className="text-brain-accent" onClick={() => handleStatusChange('in_progress')}>
              Start
            </Button>
          )}
          {task.status === 'in_progress' && (
            <>
              <Button variant="ghost" size="xs" className="text-brain-green" onClick={() => handleStatusChange('completed')}>
                Done
              </Button>
              <Button variant="ghost" size="xs" className="text-brain-amber" onClick={() => handleStatusChange('blocked')}>
                Block
              </Button>
            </>
          )}
          {task.status === 'reviewed' && (
            <Button variant="ghost" size="xs" className="text-brain-green" onClick={() => handleStatusChange('completed')}>
              Complete
            </Button>
          )}
          {task.status === 'blocked' && (
            <Button variant="ghost" size="xs" className="text-brain-accent" onClick={() => handleStatusChange('in_progress')}>
              Unblock
            </Button>
          )}
          {task.status === 'interrupted' && (
            <Button variant="ghost" size="xs" className="text-brain-accent" onClick={() => handleStatusChange('in_progress')}>
              Resume
            </Button>
          )}
          {task.status === 'completed' && (
            <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={() => handleStatusChange('pending')}>
              Reset
            </Button>
          )}
          {task.status === 'verification_failed' && (
            <Button
              variant="ghost"
              size="xs"
              className="text-brain-accent"
              onClick={() => retryMutation.mutate()}
              disabled={retryMutation.isPending}
            >
              <RotateCcw className={cn('size-3 mr-0.5', retryMutation.isPending && 'animate-spin')} />
              Retry
            </Button>
          )}
        </div>
      </div>

      {/* Verification failed details */}
      {task.status === 'verification_failed' && task.verificationResult && (
        <div className="ml-6 mt-1 mb-1 rounded-md bg-brain-red/5 border border-brain-red/10 px-3 py-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-medium text-brain-red">Verification failed</span>
            <Badge variant="secondary" className="text-[9px] text-brain-red">
              exit {task.verificationResult.exitCode}
            </Badge>
          </div>
          {task.verificationCommand && (
            <p className="text-[10px] text-[#62627a] font-mono mb-1">$ {task.verificationCommand}</p>
          )}
          {task.verificationResult.output && (
            <pre className="text-[10px] text-muted-foreground leading-relaxed whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
              {task.verificationResult.output}
            </pre>
          )}
        </div>
      )}

      {/* Verification result panel (expandable for non-failed states) */}
      {showVerification && task.verificationResult && task.status !== 'verification_failed' && (
        <div className="ml-6 mt-1 mb-1 rounded-md bg-brain-base px-3 py-2">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('text-[10px] font-medium', task.verificationResult.exitCode === 0 ? 'text-brain-green' : 'text-brain-red')}>
              Verification {task.verificationResult.exitCode === 0 ? 'passed' : 'failed'}
            </span>
            <Badge variant="secondary" className="text-[9px]">
              exit {task.verificationResult.exitCode}
            </Badge>
          </div>
          {task.verificationCommand && (
            <p className="text-[10px] text-[#62627a] font-mono mb-1">$ {task.verificationCommand}</p>
          )}
          {task.verificationResult.output && (
            <pre className="text-[10px] text-muted-foreground leading-relaxed whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
              {task.verificationResult.output}
            </pre>
          )}
        </div>
      )}

      {/* Output panel */}
      {showOutput && task.output && (
        <div className="ml-6 mt-1 mb-1 rounded-md bg-brain-base px-3 py-2 text-[11px] text-muted-foreground leading-relaxed">
          {task.output}
        </div>
      )}
    </div>
  )
}
