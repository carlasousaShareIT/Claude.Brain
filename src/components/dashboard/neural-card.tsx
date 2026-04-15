import type { MetricsData, Brain } from '@/lib/types'
import { NeuralPreviewCanvas } from './neural-preview-canvas'

interface NeuralCardProps {
  data: MetricsData | undefined
  brain?: Brain
  onClick: () => void
}

export function NeuralCard({ data, brain, onClick }: NeuralCardProps) {
  const nodeCount = brain
    ? brain.workingStyle.length + brain.architecture.length + brain.agentRules.length + brain.decisions.length
    : data?.totalEntries ?? 0

  const sectionCount = brain
    ? [brain.workingStyle, brain.architecture, brain.agentRules, brain.decisions].filter((s) => s.length > 0).length
    : 0

  if (!data && !brain) {
    return (
      <button
        onClick={onClick}
        className="col-span-2 w-full rounded-lg border border-brain-surface bg-brain-raised p-5 text-left transition-colors hover:border-brain-accent/30 hover:bg-brain-hover"
      >
        <h2 className="text-sm font-medium text-foreground mb-2">Neural Map</h2>
        <div className="h-7 w-16 rounded bg-brain-base animate-pulse" />
        <div className="h-3 w-20 rounded bg-brain-base animate-pulse mt-2" />
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className="col-span-2 w-full rounded-lg border border-brain-surface bg-brain-raised p-5 text-left transition-colors hover:border-brain-accent/30 hover:bg-brain-hover"
    >
      <div className="flex items-start justify-between mb-2">
        <h2 className="text-sm font-medium text-foreground">Neural Map</h2>
        <span className="text-xs text-muted-foreground">{nodeCount} nodes</span>
      </div>
      {brain ? (
        <div className="relative h-48 w-full rounded overflow-hidden bg-brain-base">
          <NeuralPreviewCanvas brain={brain} />
          {sectionCount > 0 && (
            <span className="absolute bottom-1.5 right-2 text-[10px] text-muted-foreground/60">
              {sectionCount} sections
            </span>
          )}
        </div>
      ) : (
        <div className="mt-1.5 space-y-0.5">
          {data && Object.entries(data.bySection)
            .sort(([, a], [, b]) => b - a)
            .map(([section, count]) => (
              <div key={section} className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">{section}</span>
                <span className="text-foreground/70">{count}</span>
              </div>
            ))}
        </div>
      )}
    </button>
  )
}
