import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, FileCode, GitBranch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { api } from '@/lib/api'

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export function AgentResultsPanel({
  sessionId,
  missionId,
}: {
  sessionId?: string
  missionId?: string
}) {
  const queryClient = useQueryClient()

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['agent-results', sessionId, missionId],
    queryFn: () => api.getAgentResults({ session: sessionId, mission: missionId }),
  })

  const deleteResult = useMutation({
    mutationFn: (id: string) => api.deleteAgentResult(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['agent-results', sessionId, missionId] }),
  })

  if (isLoading) {
    return <p className="py-4 text-center text-xs text-[#62627a]">Loading...</p>
  }

  if (results.length === 0) {
    return <p className="py-4 text-center text-xs text-[#62627a]">No agent results.</p>
  }

  return (
    <ScrollArea className="max-h-[500px]">
      <div className="space-y-2">
        {results.map((result) => (
          <div
            key={result.id}
            className="group rounded-lg bg-brain-raised px-3 py-2.5 ring-1 ring-white/5"
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{result.agent}</span>
                  {result.taskId && (
                    <span className="rounded bg-brain-surface px-1.5 py-0.5 text-[10px] text-[#62627a]">
                      task: {result.taskId}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-foreground/80">{result.summary}</p>

                {result.changedFiles.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    <FileCode className="h-3 w-3 text-[#62627a]" />
                    {result.changedFiles.map((file) => (
                      <code
                        key={file}
                        className="rounded bg-brain-surface px-1 py-0.5 text-[10px] text-foreground/70"
                      >
                        {file}
                      </code>
                    ))}
                  </div>
                )}

                <div className="mt-1.5 flex items-center gap-2">
                  {result.branch && (
                    <span className="flex items-center gap-1 text-[10px] text-[#62627a]">
                      <GitBranch className="h-3 w-3" />
                      {result.branch}
                    </span>
                  )}
                  <span className="text-[10px] text-[#62627a]">
                    {formatTimestamp(result.createdAt)}
                  </span>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-[#62627a] opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                onClick={() => deleteResult.mutate(result.id)}
                disabled={deleteResult.isPending}
                aria-label="Delete result"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
