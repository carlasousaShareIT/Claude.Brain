import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, MessageSquarePlus, CheckCircle2, XCircle, Trash2, ThumbsUp, ThumbsDown, Minus } from 'lucide-react'
import { cn, projectColor } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { EffectivenessPanel } from '@/components/experiments/effectiveness-panel'
import { api } from '@/lib/api'
import type { ExperimentSummary } from '@/lib/types'

interface ExperimentCardProps {
  experiment: ExperimentSummary
  onConclude: (id: string, conclusion: string) => void
  onAbandon: (id: string) => void
  onDelete: (id: string) => void
  onAddObservation: (experimentId: string, text: string, sentiment: string) => void
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-brain-green/20 text-brain-green',
  concluded: 'bg-blue-500/20 text-blue-400',
  abandoned: 'bg-white/10 text-[#62627a]',
}

const CONCLUSION_COLORS: Record<string, string> = {
  positive: 'bg-brain-green/20 text-brain-green',
  negative: 'bg-red-500/20 text-red-400',
  mixed: 'bg-brain-amber/20 text-brain-amber',
}

function sentimentIcon(sentiment: string) {
  switch (sentiment) {
    case 'positive':
      return <ThumbsUp className="h-3 w-3 text-brain-green" />
    case 'negative':
      return <ThumbsDown className="h-3 w-3 text-red-400" />
    default:
      return <Minus className="h-3 w-3 text-[#62627a]" />
  }
}

function sentimentSummary(breakdown: ExperimentSummary['sentimentBreakdown'], count: number): string {
  if (count === 0) return '0 obs'
  const parts: string[] = []
  if (breakdown.positive > 0) parts.push(`${breakdown.positive}+`)
  if (breakdown.negative > 0) parts.push(`${breakdown.negative}-`)
  if (breakdown.neutral > 0) parts.push(`${breakdown.neutral}~`)
  return `${count} obs (${parts.join(', ')})`
}

export function ExperimentCard({ experiment, onConclude, onAbandon, onDelete, onAddObservation }: ExperimentCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [showAddObs, setShowAddObs] = useState(false)
  const [obsText, setObsText] = useState('')
  const [obsSentiment, setObsSentiment] = useState<'positive' | 'negative' | 'neutral'>('neutral')
  const [showConclude, setShowConclude] = useState(false)

  const handleAddObsSubmit = useCallback(() => {
    const text = obsText.trim()
    if (!text) return
    onAddObservation(experiment.id, text, obsSentiment)
    setObsText('')
    setObsSentiment('neutral')
    setShowAddObs(false)
  }, [obsText, obsSentiment, experiment.id, onAddObservation])

  const handleObsKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleAddObsSubmit()
      if (e.key === 'Escape') {
        setShowAddObs(false)
        setObsText('')
        setObsSentiment('neutral')
      }
    },
    [handleAddObsSubmit],
  )

  const { data: fullExperiment } = useQuery({
    queryKey: ['experiment', experiment.id],
    queryFn: () => api.getExperiment(experiment.id),
    enabled: expanded,
  })

  const isActive = experiment.status === 'active'

  return (
    <div className="group rounded-lg bg-brain-raised px-3 py-2.5 ring-1 ring-white/5">
      <div className="flex items-start gap-3">
        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-0.5 shrink-0 text-[#62627a] hover:text-foreground"
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug text-foreground">{experiment.name}</p>
          <p className="mt-0.5 text-xs leading-snug text-[#62627a]">{experiment.hypothesis}</p>

          {/* Meta row */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', STATUS_COLORS[experiment.status])}>
              {experiment.status}
            </span>
            {experiment.conclusion && (
              <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', CONCLUSION_COLORS[experiment.conclusion])}>
                {experiment.conclusion}
              </span>
            )}
            <span className="text-[10px] text-[#62627a]">
              {sentimentSummary(experiment.sentimentBreakdown, experiment.observationCount)}
            </span>
            {experiment.project.map((p) => (
              <span
                key={p}
                className="rounded px-1.5 py-0.5 text-[10px]"
                style={{ backgroundColor: `${projectColor(p)}20`, color: projectColor(p) }}
              >
                {p}
              </span>
            ))}
          </div>
        </div>

        {/* Action buttons — visible on hover */}
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {isActive && (
            <>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-[#62627a] hover:text-foreground"
                      onClick={() => {
                        setShowAddObs((v) => !v)
                        setShowConclude(false)
                      }}
                      aria-label="Add observation"
                    />
                  }
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                </TooltipTrigger>
                <TooltipContent side="top">Add observation.</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-[#62627a] hover:text-foreground"
                      onClick={() => {
                        setShowConclude((v) => !v)
                        setShowAddObs(false)
                      }}
                      aria-label="Conclude"
                    />
                  }
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </TooltipTrigger>
                <TooltipContent side="top">Conclude.</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-[#62627a] hover:text-foreground"
                      onClick={() => onAbandon(experiment.id)}
                      aria-label="Abandon"
                    />
                  }
                >
                  <XCircle className="h-3.5 w-3.5" />
                </TooltipTrigger>
                <TooltipContent side="top">Abandon.</TooltipContent>
              </Tooltip>
            </>
          )}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-[#62627a] hover:text-red-400"
                  onClick={() => onDelete(experiment.id)}
                  aria-label="Delete"
                />
              }
            >
              <Trash2 className="h-3.5 w-3.5" />
            </TooltipTrigger>
            <TooltipContent side="top">Delete.</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Conclude dropdown */}
      {showConclude && (
        <div className="mt-2 flex items-center gap-2 rounded bg-brain-surface px-3 py-2">
          <span className="text-xs text-[#62627a]">Conclusion:</span>
          {(['positive', 'negative', 'mixed'] as const).map((c) => (
            <button
              key={c}
              onClick={() => {
                onConclude(experiment.id, c)
                setShowConclude(false)
              }}
              className={cn(
                'rounded px-2 py-0.5 text-xs font-medium transition-colors',
                CONCLUSION_COLORS[c],
                'hover:opacity-80',
              )}
            >
              {c}
            </button>
          ))}
          <button
            onClick={() => setShowConclude(false)}
            className="ml-auto text-xs text-[#62627a] hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Inline add observation form */}
      {showAddObs && (
        <div
          className="mt-2 flex items-center gap-2 rounded bg-brain-surface px-3 py-2"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) {
              setShowAddObs(false)
              setObsText('')
              setObsSentiment('neutral')
            }
          }}
        >
          <input
            autoFocus
            type="text"
            placeholder="Observation…"
            value={obsText}
            onChange={(e) => setObsText(e.target.value)}
            onKeyDown={handleObsKeyDown}
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-[#62627a] focus:outline-none"
          />
          <select
            value={obsSentiment}
            onChange={(e) => setObsSentiment(e.target.value as 'positive' | 'negative' | 'neutral')}
            className="rounded bg-brain-raised px-1.5 py-0.5 text-xs text-[#62627a] focus:outline-none"
          >
            <option value="positive">Positive</option>
            <option value="negative">Negative</option>
            <option value="neutral">Neutral</option>
          </select>
          <Button
            size="xs"
            variant="ghost"
            className="text-brain-accent hover:text-brain-accent/80"
            onClick={handleAddObsSubmit}
            disabled={!obsText.trim()}
          >
            Save
          </Button>
        </div>
      )}

      {/* Expanded observations + effectiveness */}
      {expanded && (
        <div className="mt-2 space-y-3 border-t border-white/5 pt-2 pl-7">
          {experiment.observationCount >= 4 && (
            <EffectivenessPanel experimentId={experiment.id} />
          )}
          <p className="text-[10px] font-medium uppercase tracking-wider text-[#62627a]">
            Observations ({experiment.observationCount})
          </p>
          {fullExperiment?.observations && fullExperiment.observations.length > 0 ? (
            fullExperiment.observations.slice(-5).reverse().map((obs, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0">{sentimentIcon(obs.sentiment)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-foreground/80">{obs.text}</p>
                  <p className="text-[10px] text-[#62627a]">
                    {new Date(obs.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {obs.source === 'user' && ' (user)'}
                  </p>
                </div>
              </div>
            ))
          ) : experiment.observationCount === 0 ? (
            <p className="text-xs text-[#62627a]">No observations yet.</p>
          ) : (
            <p className="text-xs text-[#62627a]">Loading...</p>
          )}
        </div>
      )}
    </div>
  )
}
