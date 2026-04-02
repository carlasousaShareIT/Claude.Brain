import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn, timeAgo, truncate, projectColor } from '@/lib/utils'
import { SECTION_COLORS, SECTION_LABELS } from '@/lib/constants'
import { useBrain } from '@/hooks/use-brain'
import type { SessionSummary, BrainEntry, Decision } from '@/lib/types'

interface SessionTimelineProps {
  session: SessionSummary
}

interface TimelineItem {
  text: string
  section: string
  createdAt: string
}

function extractEntries(
  entries: BrainEntry[],
  section: string,
  sessionId: string,
): TimelineItem[] {
  return entries
    .filter((e) => e.sessionId === sessionId)
    .map((e) => ({ text: e.text, section, createdAt: e.createdAt }))
}

function extractDecisions(
  decisions: Decision[],
  sessionId: string,
): TimelineItem[] {
  return decisions
    .filter((d) => d.sessionId === sessionId)
    .map((d) => ({ text: d.decision, section: 'decisions', createdAt: d.createdAt }))
}

export function SessionTimeline({ session }: SessionTimelineProps) {
  const { data: brain, isLoading } = useBrain()

  const { items, summary } = useMemo(() => {
    if (!brain) return { items: [], summary: null }

    const all: TimelineItem[] = [
      ...extractEntries(brain.workingStyle, 'workingStyle', session.id),
      ...extractEntries(brain.architecture, 'architecture', session.id),
      ...extractEntries(brain.agentRules, 'agentRules', session.id),
      ...extractDecisions(brain.decisions, session.id),
    ]

    all.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    const sectionsTouched = [...new Set(all.map((e) => e.section))]
    const sectionCounts: Record<string, number> = {}
    for (const item of all) {
      sectionCounts[item.section] = (sectionCounts[item.section] || 0) + 1
    }

    return {
      items: all,
      summary: {
        totalEntries: all.length,
        sectionsTouched,
        sectionCounts,
        projects: session.projects ?? [],
      },
    }
  }, [brain, session.id, session.projects])

  if (isLoading) {
    return (
      <div className="px-3 pb-3 pt-1">
        <p className="text-[10px] text-[#62627a]">Loading entries...</p>
      </div>
    )
  }

  if (!summary || items.length === 0) {
    return (
      <div className="px-3 pb-3 pt-1">
        <p className="text-[10px] text-[#62627a]">No entries found for this session.</p>
      </div>
    )
  }

  const grouped: Record<string, TimelineItem[]> = {}
  for (const item of items) {
    if (!grouped[item.section]) grouped[item.section] = []
    grouped[item.section].push(item)
  }

  return (
    <div className="border-t border-white/5 px-3 pb-3 pt-2">
      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[10px] text-[#62627a]">
        <span>{summary.totalEntries} {summary.totalEntries === 1 ? 'entry' : 'entries'} across</span>
        {summary.sectionsTouched.map((s) => (
          <Badge
            key={s}
            variant="secondary"
            className="text-[10px]"
            style={{
              backgroundColor: `${SECTION_COLORS[s] ?? '#62627a'}15`,
              color: SECTION_COLORS[s] ?? '#62627a',
            }}
          >
            {SECTION_LABELS[s] ?? s} ({summary.sectionCounts[s]})
          </Badge>
        ))}
        {summary.projects.length > 0 && (
          <>
            <span>in</span>
            {summary.projects.map((p) => (
              <Badge
                key={p}
                variant="secondary"
                className="text-[10px]"
                style={{
                  backgroundColor: `${projectColor(p)}20`,
                  color: projectColor(p),
                }}
              >
                {p}
              </Badge>
            ))}
          </>
        )}
      </div>

      <div className="space-y-2">
        {Object.entries(grouped).map(([section, sectionItems]) => (
          <div key={section}>
            <div className="mb-1 flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: SECTION_COLORS[section] ?? '#62627a' }}
              />
              <span
                className="text-[10px] font-medium"
                style={{ color: SECTION_COLORS[section] ?? '#62627a' }}
              >
                {SECTION_LABELS[section] ?? section}
              </span>
            </div>
            <div className="ml-[14px] space-y-0.5">
              {sectionItems.map((item, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-baseline gap-2 rounded px-1.5 py-0.5',
                    'hover:bg-brain-hover/50',
                  )}
                >
                  <span className="shrink-0 text-[10px] text-[#62627a]">
                    {timeAgo(item.createdAt)}
                  </span>
                  <span className="text-xs text-foreground/80 leading-snug">
                    {truncate(item.text, 120)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
