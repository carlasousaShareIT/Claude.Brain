import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Archive, Copy, ChevronDown, ChevronRight, MessageSquare, Send } from 'lucide-react'
import { api } from '@/lib/api'
import { useBrain } from '@/hooks/use-brain'
import { useArchived } from '@/hooks/use-archived'
import { SECTION_COLORS, SECTION_LABELS } from '@/lib/constants'
import { cn, timeAgo, entryText } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import type { BrainEntry, Decision, ArchivedEntry, SectionName, Annotation } from '@/lib/types'

interface EntryDetailDialogProps {
  entry: BrainEntry | Decision | ArchivedEntry | null
  section: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function EntryDetailDialog({ entry, section, open, onOpenChange }: EntryDetailDialogProps) {
  const { setConfidence } = useBrain()
  const { archive } = useArchived()
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [sessionCopied, setSessionCopied] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [annotationText, setAnnotationText] = useState('')

  const annotateMutation = useMutation({
    mutationFn: api.annotate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brain'] })
      setAnnotationText('')
    },
  })

  if (!entry) return null

  const text = entryText(entry)
  const color = SECTION_COLORS[section] ?? '#9d9db5'
  const sectionLabel = SECTION_LABELS[section] ?? section
  const isDecision = 'decision' in entry && 'status' in entry
  const decision = isDecision ? (entry as Decision) : null
  const annotations = entry.annotations ?? []
  const history = entry.history ?? []
  const confidence = entry.confidence

  const handleToggleConfidence = () => {
    const newConfidence = confidence === 'firm' ? 'tentative' : 'firm'
    setConfidence.mutate({
      section: section as SectionName,
      text,
      confidence: newConfidence,
    })
  }

  const handleArchive = () => {
    archive.mutate({ section: section as SectionName, text })
    onOpenChange(false)
  }

  const handleCopyText = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopySession = async () => {
    if (!entry.sessionId) return
    await navigator.clipboard.writeText(entry.sessionId)
    setSessionCopied(true)
    setTimeout(() => setSessionCopied(false), 2000)
  }

  const handleAddAnnotation = () => {
    if (!annotationText.trim()) return
    annotateMutation.mutate({
      section: section as SectionName,
      text,
      note: annotationText.trim(),
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAddAnnotation()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogTitle className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <span>{sectionLabel}</span>
          {decision && (
            <Badge
              variant="outline"
              className="ml-auto text-[10px] h-5"
            >
              {decision.status}
            </Badge>
          )}
        </DialogTitle>

        {/* Full text. */}
        <div className="mt-4 rounded-md bg-brain-surface/50 p-3">
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
            {text}
          </p>
        </div>

        {/* Metadata panel. */}
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
          <MetaField label="Section">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-foreground/80">{sectionLabel}</span>
            </span>
          </MetaField>

          <MetaField label="Confidence">
            <button
              onClick={handleToggleConfidence}
              className={cn(
                'inline-flex items-center rounded-full px-1.5 py-px text-[10px] font-medium transition-colors cursor-pointer',
                confidence === 'firm'
                  ? 'bg-brain-green/15 text-brain-green'
                  : 'bg-brain-amber/15 text-brain-amber',
              )}
            >
              {confidence}
            </button>
          </MetaField>

          <MetaField label="Projects">
            <div className="flex flex-wrap gap-1">
              {entry.project.map((p) => (
                <Badge
                  key={p}
                  variant="secondary"
                  className="h-4 px-1 text-[9px] bg-brain-surface text-muted-foreground"
                >
                  {p}
                </Badge>
              ))}
            </div>
          </MetaField>

          <MetaField label="Session ID">
            {entry.sessionId ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      onClick={handleCopySession}
                      className="text-xs text-foreground/80 font-mono cursor-pointer hover:text-foreground transition-colors"
                    />
                  }
                >
                  {sessionCopied ? 'Copied' : entry.sessionId.slice(0, 12) + '\u2026'}
                </TooltipTrigger>
                <TooltipContent side="top">
                  Click to copy full session ID.
                </TooltipContent>
              </Tooltip>
            ) : (
              <span className="text-xs text-foreground/40">None</span>
            )}
          </MetaField>

          <MetaField label="Source">
            <span className="text-xs text-foreground/80">{entry.source || 'Unknown'}</span>
          </MetaField>

          <MetaField label="Created">
            <span className="text-xs text-foreground/80">{formatDate(entry.createdAt)}</span>
          </MetaField>

          <MetaField label="Last touched">
            <span className="text-xs text-foreground/80">
              {formatDate(entry.lastTouched || entry.createdAt)}
              <span className="ml-1 text-[#8585a0]">
                ({timeAgo(entry.lastTouched || entry.createdAt)})
              </span>
            </span>
          </MetaField>
        </div>

        {/* History section. */}
        {history.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setHistoryOpen(!historyOpen)}
              className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-[#8585a0] hover:text-foreground/60 transition-colors cursor-pointer"
            >
              {historyOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              History ({history.length})
            </button>
            {historyOpen && (
              <div className="mt-2 space-y-2 pl-4 border-l border-brain-surface">
                {history.map((h, i) => (
                  <div key={i} className="text-xs">
                    <div className="flex items-center gap-2 text-[#8585a0]">
                      <span>{formatDate(h.changedAt)}</span>
                      <span>by {h.changedBy}</span>
                    </div>
                    <p className="mt-0.5 text-foreground/60 whitespace-pre-wrap">{h.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Annotations section. */}
        <div className="mt-4">
          <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-[#8585a0]">
            <MessageSquare className="size-3" />
            Annotations ({annotations.length})
          </div>
          {annotations.length > 0 && (
            <div className="mt-2 space-y-2">
              {annotations.map((a, i) => (
                <AnnotationItem key={i} annotation={a} />
              ))}
            </div>
          )}
          <div className="mt-2 flex gap-1.5">
            <input
              type="text"
              value={annotationText}
              onChange={(e) => setAnnotationText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add annotation..."
              className="flex-1 h-7 rounded-md bg-brain-surface border border-brain-surface px-2 text-xs text-foreground placeholder:text-[#8585a0] outline-none focus:border-foreground/20 transition-colors"
            />
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleAddAnnotation}
              disabled={!annotationText.trim() || annotateMutation.isPending}
            >
              <Send className="size-3 text-muted-foreground" />
            </Button>
          </div>
        </div>

        {/* Actions. */}
        <div className="mt-4 pt-3 border-t border-brain-surface flex items-center gap-2">
          <Button variant="ghost" size="xs" onClick={handleArchive}>
            <Archive className="size-3 mr-1" />
            Archive
          </Button>
          <Button variant="ghost" size="xs" onClick={handleCopyText}>
            <Copy className="size-3 mr-1" />
            {copied ? 'Copied' : 'Copy text'}
          </Button>
          <Button variant="ghost" size="xs" onClick={handleToggleConfidence}>
            Toggle to {confidence === 'firm' ? 'tentative' : 'firm'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function MetaField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-[#8585a0]">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  )
}

function AnnotationItem({ annotation }: { annotation: Annotation }) {
  return (
    <div className="rounded-md bg-brain-surface/50 px-2.5 py-1.5">
      <p className="text-xs text-foreground/80">{annotation.note}</p>
      <div className="mt-1 flex items-center gap-2 text-[10px] text-[#8585a0]">
        <span>{formatDate(annotation.ts)}</span>
        {annotation.source && <span>{annotation.source}</span>}
      </div>
    </div>
  )
}
