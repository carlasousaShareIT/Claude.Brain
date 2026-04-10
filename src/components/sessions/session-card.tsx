import { useMemo } from 'react'
import { ChevronDown, ChevronRight, Clock, Filter, Layers } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn, timeAgo, projectColor } from '@/lib/utils'
import { SessionTimeline } from './session-timeline'
import { SessionHandoffSection } from './session-handoff'
import type { SessionSummary } from '@/lib/types'

interface SessionCardProps {
  session: SessionSummary
  onFilter: (id: string) => void
  isFiltered: boolean
  isExpanded: boolean
  onToggleExpand: (id: string) => void
}

export function SessionCard({
  session,
  onFilter,
  isFiltered,
  isExpanded,
  onToggleExpand,
}: SessionCardProps) {
  const displayName = useMemo(() => {
    if (session.label) return session.label
    return session.id
  }, [session.label, session.id])

  const isLabelPresent = !!session.label

  const sectionEntries = Object.entries(session.sections)

  return (
    <Card
      className={cn(
        'border-0 bg-brain-raised ring-1 ring-white/5 transition-colors',
        isFiltered && 'ring-brain-accent/50',
        isExpanded && 'ring-white/10',
      )}
    >
      <CardContent className="p-0">
        <div
          className="cursor-pointer p-3 hover:bg-brain-hover/30 transition-colors"
          onClick={() => onToggleExpand(session.id)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-start gap-1.5">
              {isExpanded
                ? <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#62627a]" />
                : <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#62627a]" />
              }
              <p
                className={cn(
                  'text-sm font-semibold leading-snug truncate',
                  !isLabelPresent && 'font-mono text-[#62627a] text-xs',
                )}
              >
                {displayName}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="xs"
                      className={cn(
                        'h-5 w-5 p-0 text-[#62627a] hover:text-foreground',
                        isFiltered && 'text-brain-accent',
                      )}
                      onClick={(e) => {
                        e.stopPropagation()
                        onFilter(session.id)
                      }}
                    />
                  }
                >
                  <Filter className="h-3 w-3" />
                </TooltipTrigger>
                <TooltipContent side="left">
                  {isFiltered ? 'Remove sidebar filter.' : 'Filter sidebar to session.'}
                </TooltipContent>
              </Tooltip>
              {session.latest && (
                <div className="flex items-center gap-1 text-[10px] text-[#62627a]">
                  <Clock className="h-3 w-3" />
                  <span>{timeAgo(session.latest)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-2 ml-5 flex flex-wrap items-center gap-1.5">
            {(session.projects ?? []).map((project) => (
              <Badge
                key={project}
                variant="secondary"
                className="text-[10px]"
                style={{
                  backgroundColor: `${projectColor(project)}20`,
                  color: projectColor(project),
                }}
              >
                {project}
              </Badge>
            ))}

            <div className="flex items-center gap-1 text-[10px] text-[#62627a]">
              <Layers className="h-3 w-3" />
              <span>{session.count} {session.count === 1 ? 'entry' : 'entries'}</span>
            </div>

            {sectionEntries.map(([section, count]) => (
              <Badge
                key={section}
                variant="secondary"
                className="text-[10px] bg-brain-base text-[#62627a]"
              >
                {section}: {count}
              </Badge>
            ))}
          </div>
        </div>

        {isExpanded && (
          <>
            <SessionHandoffSection sessionId={session.id} />
            <SessionTimeline session={session} />
          </>
        )}
      </CardContent>
    </Card>
  )
}
