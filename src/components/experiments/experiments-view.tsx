import { useCallback, useState } from 'react'
import { Plus } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { QueryError } from '@/components/ui/query-error'
import { cn } from '@/lib/utils'
import { useExperiments } from '@/hooks/use-experiments'
import { ExperimentCard } from './experiment-card'

type StatusFilter = 'active' | 'concluded' | 'all'

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'concluded', label: 'Concluded' },
  { key: 'all', label: 'All' },
]

export function ExperimentsView() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState('')
  const [addHypothesis, setAddHypothesis] = useState('')

  const { data: experiments, isLoading, isError, refetch, createExperiment, updateExperiment, addObservation, deleteExperiment } = useExperiments(
    statusFilter === 'all' ? undefined : statusFilter,
  )

  const handleConclude = useCallback(
    (id: string, conclusion: string) => updateExperiment.mutate({ id, status: 'concluded', conclusion }),
    [updateExperiment],
  )

  const handleAbandon = useCallback(
    (id: string) => updateExperiment.mutate({ id, status: 'abandoned' }),
    [updateExperiment],
  )

  const handleDelete = useCallback(
    (id: string) => deleteExperiment.mutate(id),
    [deleteExperiment],
  )

  const handleAddObservation = useCallback(
    (experimentId: string, text: string, sentiment: string) =>
      addObservation.mutate({ experimentId, text, sentiment }),
    [addObservation],
  )

  const handleAddSubmit = useCallback(() => {
    const name = addName.trim()
    const hypothesis = addHypothesis.trim()
    if (!name || !hypothesis) return
    createExperiment.mutate(
      { name, hypothesis },
      {
        onSuccess: () => {
          setAddName('')
          setAddHypothesis('')
          setShowAdd(false)
        },
      },
    )
  }, [addName, addHypothesis, createExperiment])

  const handleAddKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) handleAddSubmit()
      if (e.key === 'Escape') {
        setShowAdd(false)
        setAddName('')
        setAddHypothesis('')
      }
    },
    [handleAddSubmit],
  )

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading experiments...</p>
      </div>
    )
  }

  if (isError) {
    return <QueryError message="Failed to load experiments." onRetry={refetch} />
  }

  const list = experiments ?? []

  return (
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/5 px-4 py-2">
        {/* Status filter toggles */}
        <div className="flex items-center gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                statusFilter === f.key
                  ? 'bg-brain-surface text-foreground'
                  : 'text-[#62627a] hover:text-foreground/80',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Add button */}
        <Button
          variant="ghost"
          size="xs"
          className="gap-1 text-[#62627a] hover:text-foreground"
          onClick={() => setShowAdd((v) => !v)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 px-4 pt-3 pb-4">
          {/* Inline add form */}
          {showAdd && (
            <div
              className="flex flex-col gap-2 rounded-lg bg-brain-raised px-3 py-2.5 ring-1 ring-white/5"
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) {
                  setShowAdd(false)
                  setAddName('')
                  setAddHypothesis('')
                }
              }}
            >
              <input
                autoFocus
                type="text"
                placeholder="Experiment name…"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                onKeyDown={handleAddKeyDown}
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-[#62627a] focus:outline-none"
              />
              <input
                type="text"
                placeholder="Hypothesis…"
                value={addHypothesis}
                onChange={(e) => setAddHypothesis(e.target.value)}
                onKeyDown={handleAddKeyDown}
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-[#62627a] focus:outline-none"
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  size="xs"
                  variant="ghost"
                  className="text-[#62627a] hover:text-foreground"
                  onClick={() => {
                    setShowAdd(false)
                    setAddName('')
                    setAddHypothesis('')
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  className="text-brain-accent hover:text-brain-accent/80"
                  onClick={handleAddSubmit}
                  disabled={!addName.trim() || !addHypothesis.trim() || createExperiment.isPending}
                >
                  Save
                </Button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!showAdd && list.length === 0 && (
            <p className="py-8 text-center text-xs text-[#62627a]">No experiments. Start one to test a hypothesis.</p>
          )}

          {/* Experiment cards */}
          {list.map((experiment) => (
            <ExperimentCard
              key={experiment.id}
              experiment={experiment}
              onConclude={handleConclude}
              onAbandon={handleAbandon}
              onDelete={handleDelete}
              onAddObservation={handleAddObservation}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
