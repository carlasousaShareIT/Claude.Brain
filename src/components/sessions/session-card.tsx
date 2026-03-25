import { useMemo } from 'react'
import { Clock, Layers } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn, timeAgo } from '@/lib/utils'
import type { SessionSummary } from '@/lib/types'

interface SessionCardProps {
  session: SessionSummary
  onSelect: (id: string) => void
  isSelected: boolean
}

function projectColor(project: string): string {
  let hash = 0
  for (let i = 0; i < project.length; i++) {
    hash = project.charCodeAt(i) + ((hash << 5) - hash)
  }
  return `hsl(${Math.abs(hash) % 360}, 60%, 65%)`
}

export function SessionCard({ session, onSelect, isSelected }: SessionCardProps) {
  const displayName = useMemo(() => {
    if (session.label) return session.label
    return session.id
  }, [session.label, session.id])

  const isLabelPresent = !!session.label

  const sectionEntries = Object.entries(session.sections)

  return (
    <Card
      className={cn(
        'border-0 bg-brain-raised ring-1 ring-white/5 cursor-pointer transition-colors hover:ring-white/10',
        isSelected && 'ring-brain-accent/50',
      )}
      onClick={() => onSelect(session.id)}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                'text-sm font-semibold leading-snug truncate',
                !isLabelPresent && 'font-mono text-[#62627a] text-xs',
              )}
            >
              {displayName}
            </p>
          </div>
          {session.latest && (
            <div className="flex shrink-0 items-center gap-1 text-[10px] text-[#62627a]">
              <Clock className="h-3 w-3" />
              <span>{timeAgo(session.latest)}</span>
            </div>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {/* Project badges */}
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

          {/* Entry count */}
          <div className="flex items-center gap-1 text-[10px] text-[#62627a]">
            <Layers className="h-3 w-3" />
            <span>{session.count} {session.count === 1 ? 'entry' : 'entries'}</span>
          </div>

          {/* Section breakdown */}
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
      </CardContent>
    </Card>
  )
}
