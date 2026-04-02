import { useCallback } from 'react'
import { Archive, ArchiveRestore, MessageSquare } from 'lucide-react'
import { useBrain } from '@/hooks/use-brain'
import { useArchived } from '@/hooks/use-archived'
import { SECTION_COLORS } from '@/lib/constants'
import { cn, timeAgo, entryText } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { BrainEntry, Decision, ArchivedEntry, SectionName } from '@/lib/types'

interface BrainItemProps {
  entry: BrainEntry | Decision | ArchivedEntry
  section: string
  isArchived?: boolean
  onSelect?: (entry: BrainEntry | Decision | ArchivedEntry, section: string) => void
}

export function BrainItem({ entry, section, isArchived = false, onSelect }: BrainItemProps) {
  const { setConfidence } = useBrain()
  const { archive, unarchive } = useArchived()

  const text = entryText(entry)
  const color = SECTION_COLORS[section] ?? '#9d9db5'
  const isDecision = 'decision' in entry && 'status' in entry
  const decision = isDecision ? (entry as Decision) : null
  const annotations = entry.annotations ?? []
  const confidence = entry.confidence

  const handleToggleConfidence = useCallback(() => {
    const newConfidence = confidence === 'firm' ? 'tentative' : 'firm'
    setConfidence.mutate({
      section: section as SectionName,
      text,
      confidence: newConfidence,
    })
  }, [confidence, section, text, setConfidence])

  const handleArchive = useCallback(() => {
    archive.mutate({ section: section as SectionName, text })
  }, [archive, section, text])

  const handleUnarchive = useCallback(() => {
    unarchive.mutate({ text })
  }, [unarchive, text])

  return (
    <div className="group relative flex gap-2 rounded-md px-2 py-2 hover:bg-brain-hover transition-colors">
      {/* Section color bar. */}
      <span
        className="shrink-0 w-1 rounded-full self-stretch"
        style={{ backgroundColor: color }}
      />

      <div className="flex-1 min-w-0">
        {/* Entry text. */}
        <p
          className="brain-entry-text text-[13px] text-foreground/90 leading-relaxed py-0.5 cursor-pointer line-clamp-3"
          onClick={() => onSelect?.(entry, section)}
        >
          {decision && (
            <span className="mr-1.5" title={decision.status}>
              {decision.status === 'resolved' ? '✓' : '○'}
            </span>
          )}
          {text}
        </p>

        {/* Meta row. */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {/* Confidence badge. */}
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  onClick={handleToggleConfidence}
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors',
                    confidence === 'firm'
                      ? 'bg-brain-green/15 text-brain-green'
                      : 'bg-brain-amber/15 text-brain-amber',
                  )}
                />
              }
            >
              {confidence}
            </TooltipTrigger>
            <TooltipContent side="top">
              Click to toggle confidence.
            </TooltipContent>
          </Tooltip>

          {/* Time ago. */}
          <span className="text-[10px] text-[#8585a0]">
            {timeAgo(entry.lastTouched || entry.createdAt)}
          </span>

          {/* Project badges. */}
          {entry.project.map((p) => (
            <Badge
              key={p}
              variant="secondary"
              className="h-4 px-1 text-[9px] bg-brain-surface text-muted-foreground"
            >
              {p}
            </Badge>
          ))}

          {/* Annotation count. */}
          {annotations.length > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-[#8585a0]">
              <MessageSquare className="size-2.5" />
              {annotations.length}
            </span>
          )}
        </div>
      </div>

      {/* Action buttons (visible on hover). */}
      <div className="shrink-0 flex items-start opacity-0 group-hover:opacity-100 transition-opacity">
        {isArchived ? (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleUnarchive}
            title="Unarchive"
          >
            <ArchiveRestore className="size-3 text-muted-foreground" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleArchive}
            title="Archive"
          >
            <Archive className="size-3 text-muted-foreground" />
          </Button>
        )}
      </div>
    </div>
  )
}
